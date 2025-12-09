from odoo import models, fields, api

class AutomobileCustomer(models.Model):
    _name = 'automobile.customer'
    _description = 'Automobile Customer'

    partner_id = fields.Many2one('res.partner', string='Partner', required=True, ondelete='cascade')
    name = fields.Char(related='partner_id.name', string='Name', store=True)
    phone = fields.Char(related='partner_id.phone', string='Phone', store=True)
    email = fields.Char(related='partner_id.email', string='Email', store=True)
    street = fields.Char(related='partner_id.street', string='Street', store=True)
    city = fields.Char(related='partner_id.city', string='City', store=True)
    vehicle_ids = fields.One2many('automobile.vehicle', 'partner_id', string='Vehicles')
    note = fields.Text(string='Notes')
