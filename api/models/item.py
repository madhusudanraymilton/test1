from odoo import models, fields

class Item(models.Model):
    _name = 'api.item'
    _description = 'API Item'

    name = fields.Char(string='Name', required=True)
    description = fields.Text(string='Description')
