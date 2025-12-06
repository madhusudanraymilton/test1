from odoo import models, fields, api
from odoo.exceptions import AccessError
import logging

_logger = logging.getLogger(__name__)


class HrEmployeeExtended(models.Model):
    _inherit = 'hr.employee'

    #new
    # ADD THIS NEW FIELD
    portal_team_leader_id = fields.Many2one(
        'hr.employee',
        string='Portal Team Leader',
        help='Team leader who will approve leave requests from portal',
        domain=[('user_id.active', '=', True)]
    )
    #end new

    # Override barcode field to remove group restrictions for portal users
    barcode = fields.Char(
        string="Badge ID",
        help="ID used for employee identification.",
        copy=False,
        # Remove groups restriction to allow portal users to read
        groups=False
    )

    @api.model
    def search(self, domain, offset=0, limit=None, order=None):
        """
        Portal users can READ all active employees (for delegation)
        but model-level methods still apply (no write/create/unlink)
        """
        # No domain restrictions for portal users on search
        # The ir.rule handles read access (all active employees)
        return super(HrEmployeeExtended, self).search(domain, offset=offset, limit=limit, order=order)

    def _read_format(self, fnames, load='_classic_read'):
        """
        Override _read_format to allow portal users to read barcode field
        This is called internally when reading records
        """
        if self.env.user.has_group('base.group_portal') and 'barcode' in fnames:
            # Use sudo() to bypass field-level security for barcode
            return super(HrEmployeeExtended, self.sudo())._read_format(fnames, load=load)

        return super(HrEmployeeExtended, self)._read_format(fnames, load=load)

    def read(self, fields=None, load='_classic_read'):
        """
        Portal users can READ all active employees (for delegation dropdown)
        This is safe because they still can't modify any employee data
        """
        # Allow portal users to read all active employees
        # The write/create/unlink restrictions still apply
        return super(HrEmployeeExtended, self).read(fields=fields, load=load)

    def write(self, vals):
        """
        Block manual edits by portal users, but allow internal system writes
        (e.g., login timezone sync, employee sync).
        """

        # Allow system writes (sudo), environment without user interaction
        if self.env.su:
            return super().write(vals)

        # Allow writes if called by non-portal users
        if not self.env.user.has_group('base.group_portal'):
            return super().write(vals)

        # Portal user writing to their own linked employee automatically during login? Allow it.
        # The login sync should never block.
        if self.env.context.get('install_mode') or self.env.context.get('sync_employee'):
            return super().write(vals)

        # Block manual edits by portal users
        raise AccessError("Portal users cannot modify employee records.")

    def create(self, vals_list):
        """
        Prevent portal users from creating employee records
        """
        if self.env.user.has_group('base.group_portal'):
            raise AccessError("Portal users cannot create employee records.")

        return super(HrEmployeeExtended, self).create(vals_list)

    def unlink(self):
        """
        Prevent portal users from deleting employee records
        """
        if self.env.user.has_group('base.group_portal'):
            raise AccessError("Portal users cannot delete employee records.")

        return super(HrEmployeeExtended, self).unlink()