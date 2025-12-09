from odoo import models, fields, api, _
from odoo.exceptions import UserError
from datetime import datetime

class ServiceOrderLine(models.Model):
    _name = 'automobile.service.order.line'
    _description = 'Service Order Line'

    order_id = fields.Many2one('automobile.service.order', string='Service Order', required=True, ondelete='cascade')
    name = fields.Char(string='Service / Product', required=True)
    description = fields.Text(string='Description')
    qty = fields.Float(string='Quantity', default=1.0)
    price_unit = fields.Monetary(string='Unit Price', currency_field='currency_id', default=0.0)
    subtotal = fields.Monetary(string='Subtotal', currency_field='currency_id', compute='_compute_subtotal', store=True)
    currency_id = fields.Many2one('res.currency', related='order_id.currency_id', store=True, readonly=True)

    @api.depends('qty', 'price_unit')
    def _compute_subtotal(self):
        for line in self:
            line.subtotal = line.qty * line.price_unit


class ServiceOrder(models.Model):
    _name = 'automobile.service.order'
    _description = 'Service Order'
    _inherit = ['mail.thread', 'mail.activity.mixin']  # enables chatter

    name = fields.Char(string='Order Reference', required=True, copy=False, readonly=True, default='New')
    partner_id = fields.Many2one('res.partner', string='Customer', required=True, ondelete='restrict')
    vehicle_id = fields.Many2one('automobile.vehicle', string='Vehicle', required=True, ondelete='restrict')
    date_order = fields.Datetime(string='Order Date', default=fields.Datetime.now)
    expected_date = fields.Datetime(string='Expected Completion')
    technician_id = fields.Many2one('res.users', string='Technician')
    note = fields.Text(string='Notes')

    line_ids = fields.One2many('automobile.service.order.line', 'order_id', string='Services / Parts')
    total_amount = fields.Monetary(string='Total', compute='_compute_total_amount', store=True)
    currency_id = fields.Many2one('res.currency', string='Currency', default=lambda self: self.env.company.currency_id)

    state = fields.Selection([
        ('draft', 'Draft'),
        ('confirmed', 'Confirmed'),
        ('in_progress', 'In Progress'),
        ('done', 'Done'),
        ('cancel', 'Cancelled'),
    ], string='Status', default='draft', tracking=True)

    company_id = fields.Many2one('res.company', string='Company', default=lambda self: self.env.company)

    @api.depends('line_ids.subtotal')
    def _compute_total_amount(self):
        for order in self:
            order.total_amount = sum(order.line_ids.mapped('subtotal')) if order.line_ids else 0.0

    @api.model
    def create(self, vals):
        if vals.get('name', 'New') == 'New':
            vals['name'] = self.env['ir.sequence'].next_by_code('automobile.service.order') or 'New'
        return super().create(vals)

    def action_confirm(self):
        for rec in self:
            if rec.state != 'draft':
                continue
            rec.state = 'confirmed'

    def action_start(self):
        for rec in self:
            if rec.state not in ('draft', 'confirmed'):
                raise UserError(_('Only draft/confirmed orders can be started.'))
            rec.state = 'in_progress'
            # optionally create activity or set started date

    def action_done(self):
        for rec in self:
            if rec.state != 'in_progress':
                raise UserError(_('Only in-progress orders can be marked done.'))
            rec.state = 'done'
            # example: write final odometer (if provided in note or wizard) or create invoice hook

    def action_cancel(self):
        for rec in self:
            rec.state = 'cancel'

    @api.onchange('vehicle_id')
    def _onchange_vehicle_set_partner(self):
        for rec in self:
            if rec.vehicle_id and rec.vehicle_id.partner_id:
                rec.partner_id = rec.vehicle_id.partner_id

    def unlink(self):
        for rec in self:
            if rec.state not in ('draft', 'cancel'):
                raise UserError(_('You can only delete draft or cancelled service orders.'))
        return super().unlink()
