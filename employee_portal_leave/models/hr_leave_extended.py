from odoo import models, fields, api
from odoo.exceptions import AccessError, ValidationError
import logging

_logger = logging.getLogger(__name__)


class HrLeaveExtended(models.Model):
    _inherit = 'hr.leave'

    delegate_employee_id = fields.Many2one(
        'hr.employee',
        string='Delegate To',
        help='Employee who will handle responsibilities during leave',
        tracking=True
    )

    # ADD NEW FIELDS FOR TEAM LEADER APPROVAL
    state = fields.Selection(
        selection_add=[('team_leader_approval', 'Team Leader Approval')],
        ondelete={'team_leader_approval': lambda recs: recs.write({'state': 'confirm'})}
    )

    team_leader_approved = fields.Boolean(
        string='Team Leader Approved',
        default=False,
        tracking=True
    )

    team_leader_approved_by = fields.Many2one(
        'res.users',
        string='Approved By Team Leader',
        readonly=True
    )

    team_leader_approved_date = fields.Datetime(
        string='Team Leader Approval Date',
        readonly=True
    )

    requires_team_leader_approval = fields.Boolean(
        string='Requires Team Leader Approval',
        compute='_compute_requires_team_leader_approval',
        store=True
    )

    @api.depends('employee_id', 'employee_id.portal_team_leader_id')
    def _compute_requires_team_leader_approval(self):
        """Check if leave requires team leader approval"""
        for leave in self:
            leave.requires_team_leader_approval = bool(leave.employee_id.portal_team_leader_id)

    def action_team_leader_approve(self):
        """Team leader approves the leave request"""
        for leave in self:
            if not leave.employee_id.portal_team_leader_id:
                raise ValidationError('No team leader assigned to this employee.')

            # Check if current user is the team leader
            current_employee = self.env['hr.employee'].sudo().search([
                ('user_id', '=', self.env.user.id)
            ], limit=1)

            if not current_employee:
                raise ValidationError('No employee record found for current user.')

            if current_employee.id != leave.employee_id.portal_team_leader_id.id:
                raise ValidationError('Only the assigned team leader can approve this request.')

            leave.sudo().write({
                'team_leader_approved': True,
                'team_leader_approved_by': self.env.user.id,
                'team_leader_approved_date': fields.Datetime.now(),
                'state': 'confirm',  # Move to HR approval
            })

            _logger.info(f"Leave {leave.id} approved by team leader {self.env.user.name}")

    def action_team_leader_refuse(self):
        """Team leader refuses the leave request"""
        for leave in self:
            current_employee = self.env['hr.employee'].sudo().search([
                ('user_id', '=', self.env.user.id)
            ], limit=1)

            if not current_employee:
                raise ValidationError('No employee record found for current user.')

            if current_employee.id != leave.employee_id.portal_team_leader_id.id:
                raise ValidationError('Only the assigned team leader can refuse this request.')

            leave.sudo().write({
                'state': 'refuse',
            })

            _logger.info(f"Leave {leave.id} refused by team leader {self.env.user.name}")

    @api.constrains('employee_id', 'delegate_employee_id')
    def _check_delegate_employee(self):
        for leave in self:
            if leave.delegate_employee_id and leave.employee_id == leave.delegate_employee_id:
                raise ValidationError('You cannot delegate to yourself!')

    @api.model
    def search(self, domain, offset=0, limit=None, order=None):
        """
        Restrict portal users to see ONLY:
        1. Their own leaves
        2. Leaves where they are the team leader
        """
        if self.env.user.has_group('base.group_portal'):
            # Use direct SQL query to avoid recursion
            self.env.cr.execute("""
                                SELECT id
                                FROM hr_employee
                                WHERE user_id = %s
                                  AND active = true LIMIT 1
                                """, (self.env.user.id,))

            result = self.env.cr.fetchone()

            if result:
                employee_id = result[0]
                # Portal user can see:
                # 1. Their own leaves (employee_id = current employee)
                # 2. Leaves where they are team leader (employee_id.portal_team_leader_id = current employee)
                domain = ['|',
                          ('employee_id', '=', employee_id),
                          ('employee_id.portal_team_leader_id', '=', employee_id)
                          ] + (domain or [])
            else:
                # No employee record, return empty
                domain = [('id', '=', False)]

        return super(HrLeaveExtended, self).search(domain, offset=offset, limit=limit, order=order)

    def read(self, fields=None, load='_classic_read'):
        """
        Prevent portal users from reading others' leave records
        Allow team leaders to read their team's leaves
        """
        if self.env.user.has_group('base.group_portal'):
            # Use direct SQL to get employee
            self.env.cr.execute("""
                                SELECT id
                                FROM hr_employee
                                WHERE user_id = %s
                                  AND active = true LIMIT 1
                                """, (self.env.user.id,))

            result = self.env.cr.fetchone()
            employee_id = result[0] if result else None

            for leave in self:
                # Check if this is their own leave OR if they are the team leader
                is_own_leave = employee_id and leave.employee_id.id == employee_id
                is_team_leader = employee_id and leave.employee_id.portal_team_leader_id.id == employee_id

                if not (is_own_leave or is_team_leader):
                    raise AccessError("You can only view your own leave requests or your team members' requests.")

        return super(HrLeaveExtended, self).read(fields=fields, load=load)

    def write(self, vals):
        """
        Restrict portal users from modifying leaves
        Allow team leaders to approve/refuse their team's leaves
        """
        if self.env.user.has_group('base.group_portal'):
            # Use direct SQL to get employee
            self.env.cr.execute("""
                                SELECT id
                                FROM hr_employee
                                WHERE user_id = %s
                                  AND active = true LIMIT 1
                                """, (self.env.user.id,))

            result = self.env.cr.fetchone()
            employee_id = result[0] if result else None

            for leave in self:
                # Check if user is team leader for this leave
                is_team_leader = employee_id and leave.employee_id.portal_team_leader_id.id == employee_id

                if is_team_leader:
                    # Team leader can only update specific fields
                    allowed_fields = {'state', 'team_leader_approved', 'team_leader_approved_by',
                                      'team_leader_approved_date'}
                    if not set(vals.keys()).issubset(allowed_fields):
                        raise AccessError("Team leaders can only approve or refuse leave requests.")
                    # Allow the write
                    continue

                # For own leaves, check state and ownership
                if leave.state not in ['draft', 'confirm', 'team_leader_approval']:
                    raise AccessError("You cannot modify approved or refused leave requests.")

                if not employee_id or leave.employee_id.id != employee_id:
                    raise AccessError("You can only modify your own leave requests.")

        return super(HrLeaveExtended, self).write(vals)

    def unlink(self):
        """Prevent portal users from deleting leaves"""
        if self.env.user.has_group('base.group_portal'):
            raise AccessError("Portal users cannot delete leave requests. Please cancel instead.")

        return super(HrLeaveExtended, self).unlink()


class HrLeaveAllocation(models.Model):
    _inherit = 'hr.leave.allocation'

    @api.model
    def search(self, domain, offset=0, limit=None, order=None):
        """Restrict portal users to see ONLY their own allocations"""
        if self.env.user.has_group('base.group_portal'):
            # Use direct SQL query to avoid recursion
            self.env.cr.execute("""
                                SELECT id
                                FROM hr_employee
                                WHERE user_id = %s
                                  AND active = true LIMIT 1
                                """, (self.env.user.id,))

            result = self.env.cr.fetchone()

            if result:
                employee_id = result[0]
                domain = ['&', ('employee_id', '=', employee_id)] + (domain or [])
            else:
                domain = [('id', '=', False)]

        return super(HrLeaveAllocation, self).search(domain, offset=offset, limit=limit, order=order)

    def read(self, fields=None, load='_classic_read'):
        """Prevent portal users from reading others' allocations"""
        if self.env.user.has_group('base.group_portal'):
            # Use direct SQL to get employee
            self.env.cr.execute("""
                                SELECT id
                                FROM hr_employee
                                WHERE user_id = %s
                                  AND active = true LIMIT 1
                                """, (self.env.user.id,))

            result = self.env.cr.fetchone()
            employee_id = result[0] if result else None

            for allocation in self:
                if not employee_id or allocation.employee_id.id != employee_id:
                    raise AccessError("You can only view your own leave allocations.")

        return super(HrLeaveAllocation, self).read(fields=fields, load=load)

    def write(self, vals):
        """Prevent portal users from modifying allocations"""
        if self.env.user.has_group('base.group_portal'):
            raise AccessError("Portal users cannot modify leave allocations.")

        return super(HrLeaveAllocation, self).write(vals)

    def unlink(self):
        """Prevent portal users from deleting allocations"""
        if self.env.user.has_group('base.group_portal'):
            raise AccessError("Portal users cannot delete leave allocations.")

        return super(HrLeaveAllocation, self).unlink()