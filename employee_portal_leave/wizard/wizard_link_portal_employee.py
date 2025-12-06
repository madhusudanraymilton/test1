from odoo import models, fields, api
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class WizardLinkPortalEmployee(models.TransientModel):
    """
    Wizard to bulk create employee records for portal users
    This helps HR admins to quickly link existing portal users to employees
    """
    _name = 'wizard.link.portal.employee'
    _description = 'Link Portal Users to Employees'

    user_ids = fields.Many2many(
        'res.users',
        string='Portal Users Without Employee Records',
        domain=[('share', '=', True), ('employee_ids', '=', False)],
        help='Select portal users to create employee records for'
    )

    count_selected = fields.Integer(
        string='Selected Users',
        compute='_compute_count_selected'
    )

    @api.depends('user_ids')
    def _compute_count_selected(self):
        for wizard in self:
            wizard.count_selected = len(wizard.user_ids)

    @api.model
    def default_get(self, fields_list):
        """Auto-select all portal users without employee records"""
        res = super(WizardLinkPortalEmployee, self).default_get(fields_list)

        # Find all portal users without employee records
        portal_users_without_employee = self.env['res.users'].search([
            ('share', '=', True),
            ('employee_ids', '=', False),
            ('active', '=', True)
        ])

        if portal_users_without_employee:
            res['user_ids'] = [(6, 0, portal_users_without_employee.ids)]

        return res

    def action_create_employees(self):
        """Create employee records for selected portal users"""
        self.ensure_one()

        if not self.user_ids:
            raise UserError("Please select at least one portal user.")

        created_count = 0
        errors = []

        for user in self.user_ids:
            try:
                # Double-check user doesn't have employee
                if user.employee_id:
                    errors.append(f"{user.name} already has an employee record")
                    continue

                # Create employee
                employee = self.env['hr.employee'].sudo().create({
                    'name': user.name,
                    'user_id': user.id,
                    'work_email': user.email or user.login,
                    'work_phone': user.phone if hasattr(user, 'phone') else False,
                    'active': True,
                })

                created_count += 1
                _logger.info(f"Bulk created employee (ID: {employee.id}) for portal user: {user.login}")

            except Exception as e:
                error_msg = f"{user.name}: {str(e)}"
                errors.append(error_msg)
                _logger.error(f"Failed to create employee for {user.login}: {str(e)}")

        # Show result notification
        message = f"Successfully created {created_count} employee record(s)."
        if errors:
            message += f"\n\nErrors ({len(errors)}):\n" + "\n".join(errors)

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Bulk Employee Creation Complete',
                'message': message,
                'type': 'success' if created_count > 0 else 'warning',
                'sticky': True,
            }
        }