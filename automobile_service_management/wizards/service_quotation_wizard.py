from odoo import models, fields, api, _
from odoo.exceptions import UserError


class ServiceQuotationWizard(models.TransientModel):
    _name = 'service.quotation.wizard'
    _description = 'Service Quotation Wizard'

    partner_id = fields.Many2one('res.partner', string='Customer', required=True)
    vehicle_id = fields.Many2one('automobile.vehicle', string='Vehicle', required=True)
    service_desc = fields.Text(string='Problem Description')
    service_type = fields.Selection([
        ('general', 'General Service'),
        ('engine', 'Engine Issue'),
        ('ac', 'AC Work'),
        ('electrical', 'Electrical Work'),
        ('other', 'Other'),
    ], string='Service Type', default='general')

    estimated_cost = fields.Float(string='Estimated Cost')
    estimated_time = fields.Char(string='Estimated Delivery Time')

    @api.onchange('vehicle_id')
    def _onchange_vehicle_set_partner(self):
        if self.vehicle_id and self.vehicle_id.partner_id:
            self.partner_id = self.vehicle_id.partner_id

    def action_create_quotation(self):
        """Create Service Order from wizard."""
        if not self.vehicle_id:
            raise UserError("Please select a vehicle.")
        if not self.partner_id:
            raise UserError("Customer required.")

        order_vals = {
            'partner_id': self.partner_id.id,
            'vehicle_id': self.vehicle_id.id,
            'note': self.service_desc,
            'state': 'draft',
            'line_ids': [],
        }

        if self.estimated_cost <= 0:
            raise UserError("Please enter a valid estimated cost.")

        # Default service lines (example)
        line_values = []
        if self.service_type == 'general':
            line_values.append((0, 0, {
                'name': 'General Service',
                'qty': 1,
                'price_unit': self.estimated_cost
            }))
        elif self.service_type == 'engine':
            line_values.append((0, 0, {
                'name': 'Engine Diagnostics',
                'qty': 1,
                'price_unit': self.estimated_cost
            }))
        elif self.service_type == 'ac':
            line_values.append((0, 0, {
                'name': 'AC System Checkup',
                'qty': 1,
                'price_unit': self.estimated_cost
            }))
        elif self.service_type == 'electrical':
            line_values.append((0, 0, {
                'name': 'Electrical Checkup',
                'qty': 1,
                'price_unit': self.estimated_cost
            }))
        else:
            line_values.append((0, 0, {
                'name': 'Custom Service',
                'qty': 1,
                'price_unit': self.estimated_cost
            }))

        order_vals['line_ids'] = line_values

        # Create service order
        new_order = self.env['automobile.service.order'].create(order_vals)

        return {
            'name': _('Service Order'),
            'type': 'ir.actions.act_window',
            'res_model': 'automobile.service.order',
            'view_mode': 'form',
            'res_id': new_order.id,
        }
