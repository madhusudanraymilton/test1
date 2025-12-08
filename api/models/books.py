from odoo import fields, models, api

class Book(models.Model):
    _name = 'book.books'
    _description = "Book Management with Api Flow overview"

    name = fields.Char(string="Title", required=True)
    author = fields.Char(string="Author", required=True)
    published_date = fields.Date(string="Published Date")
    isbn = fields.Char(string="ISBN", required=True, unique=True)
    pages = fields.Integer(string="Number of Pages")

