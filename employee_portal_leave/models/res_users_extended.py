from odoo import models, fields, api
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class ResUsersExtended(models.Model):
    _inherit = 'res.users'

    @api.model
    def create(self, vals):
        """Auto-create employee record when creating portal user"""
        user = super(ResUsersExtended, self).create(vals)

        # Check if user is portal user and doesn't have employee record
        if user.has_group('base.group_portal'):
            existing_employee = self.env['hr.employee'].sudo().search([
                ('user_id', '=', user.id)
            ], limit=1)

            if not existing_employee:
                try:
                    # Create employee record linked to portal user
                    employee_vals = {
                        'name': user.name,
                        'user_id': user.id,
                        'work_email': user.email or user.login,
                        'work_phone': user.phone if hasattr(user, 'phone') else False,
                        'active': True,
                    }

                    employee = self.env['hr.employee'].sudo().create(employee_vals)
                    _logger.info(f"Auto-created employee record (ID: {employee.id}) for portal user: {user.login}")

                except Exception as e:
                    _logger.error(f"Failed to auto-create employee for portal user {user.login}: {str(e)}")

        return user

    def write(self, vals):
        """Update employee record when user is updated"""
        res = super(ResUsersExtended, self).write(vals)

        for user in self:
            if user.has_group('base.group_portal') and user.employee_id:
                # Sync basic info to employee
                employee_vals = {}

                if 'name' in vals:
                    employee_vals['name'] = vals['name']
                if 'email' in vals or 'login' in vals:
                    employee_vals['work_email'] = vals.get('email', vals.get('login'))
                if 'phone' in vals:
                    employee_vals['work_phone'] = vals['phone']

                if employee_vals:
                    try:
                        user.employee_id.sudo().write(employee_vals)
                    except Exception as e:
                        _logger.error(f"Failed to sync user changes to employee: {str(e)}")

        return res

    def action_create_employee(self):
        """
        Create employee record for portal user
        This is a helper action for HR admins to manually create
        employee records for existing portal users
        """
        self.ensure_one()

        if not self.has_group('base.group_portal'):
            raise UserError("This user is not a portal user.")

        if self.employee_id:
            raise UserError("This user already has an employee record.")

        # Create employee
        employee = self.env['hr.employee'].sudo().create({
            'name': self.name,
            'user_id': self.id,
            'work_email': self.email or self.login,
            'work_phone': self.phone if hasattr(self, 'phone') else False,
            'active': True,
        })

        _logger.info(f"HR Admin manually created employee (ID: {employee.id}) for portal user: {self.login}")

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Success',
                'message': f'Employee record created for {self.name}',
                'type': 'success',
                'sticky': False,
            }
        }