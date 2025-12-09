from odoo import models, fields, api, _
from odoo.exceptions import ValidationError

class AutomobileVehicle(models.Model):
    _name = 'automobile.vehicle'
    _description = 'Vehicle'
    _rec_name = 'display_name'

    name = fields.Char(string='Vehicle Name', required=True)  # e.g., "Toyota Corolla"
    license_plate = fields.Char(string='License Plate', required=True)
    vin = fields.Char(string='VIN / Chassis No.')
    brand = fields.Char(string='Brand')
    model = fields.Char(string='Model')
    year = fields.Integer(string='Year')
    color = fields.Char(string='Color')
    odometer = fields.Float(string='Odometer (km)', default=0.0)
    image = fields.Image(string='Image')
    partner_id = fields.Many2one('res.partner', string='Owner / Customer', ondelete='set null')
    active = fields.Boolean(default=True)

    # computed display
    display_name = fields.Char(string='Display Name', compute='_compute_display_name', store=True)

    _sql_constraints = [
        ('license_plate_uniq', 'UNIQUE(license_plate)', 'License plate must be unique.'),
    ]

    @api.depends('name', 'license_plate')
    def _compute_display_name(self):
        for rec in self:
            rec.display_name = f"{rec.name} ({rec.license_plate or 'No plate'})"

    @api.constrains('odometer')
    def _check_odometer(self):
        for rec in self:
            if rec.odometer < 0:
                raise ValidationError(_('Odometer cannot be negative.'))
