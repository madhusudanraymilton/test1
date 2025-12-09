from odoo import http
from odoo.http import request
from datetime import datetime, timedelta
import base64
import logging

_logger = logging.getLogger(__name__)


class PortalLeaveController(http.Controller):

    @http.route('/my/leave/apply', type='http', auth='user', website=True)
    def apply_leave(self, **kw):
        """Render leave application form"""
        try:
            # Get current user's employee record
            employee = request.env['hr.employee'].sudo().search([
                ('user_id', '=', request.env.user.id)
            ], limit=1)

            if not employee:
                return request.render('employee_portal_leave.portal_no_employee', {
                    'error': 'No employee record found for your account. Please contact HR.',
                    'page_name': 'apply_leave',
                })

            # ADD THIS: Check if user is team leader
            team_members = request.env['hr.employee'].sudo().search([
                ('portal_team_leader_id', '=', employee.id),
                ('active', '=', True)
            ])
            is_team_leader = len(team_members) > 0

            pending_team_count = 0
            if is_team_leader:
                pending_team_count = request.env['hr.leave'].sudo().search_count([
                    ('employee_id.portal_team_leader_id', '=', employee.id),
                    ('state', '=', 'team_leader_approval')
                ])
            # END ADD

            # Get leave types that have valid allocations for current employee
            allocations = request.env['hr.leave.allocation'].sudo().search([
                ('employee_id', '=', employee.id),
                ('state', '=', 'validate'),
                ('holiday_status_id.active', '=', True),
            ])

            allocated_leave_type_ids = allocations.mapped('holiday_status_id').ids
            leave_types = request.env['hr.leave.type'].sudo().browse(allocated_leave_type_ids).sorted('name')

            # Get ALL active employees for delegation (excluding current user)
            employees = request.env['hr.employee'].sudo().search([
                ('id', '!=', employee.id),
                ('active', '=', True)
            ], order='name')

            # Calculate leave balances
            leave_balances = {}
            for leave_type in leave_types:
                allocation = allocations.filtered(lambda a: a.holiday_status_id.id == leave_type.id)
                if allocation:
                    total = sum(allocation.mapped('number_of_days'))
                    used = sum(allocation.mapped('leaves_taken'))
                    leave_balances[leave_type.id] = {
                        'total': total,
                        'used': used,
                        'remaining': total - used
                    }
                else:
                    leave_balances[leave_type.id] = {
                        'total': 0,
                        'used': 0,
                        'remaining': 0
                    }

            return request.render('employee_portal_leave.portal_apply_leave', {
                'leave_types': leave_types,
                'employees': employees,
                'allocations': allocations,
                'employee': employee,
                'leave_balances': leave_balances,
                'error': kw.get('error'),
                'success': kw.get('success'),
                'page_name': 'apply_leave',
                'is_team_leader': is_team_leader,  # ADD THIS
                'pending_team_count': pending_team_count,  # ADD THIS
            })

        except Exception as e:
            _logger.error(f"Error in apply_leave: {str(e)}", exc_info=True)
            return request.render('employee_portal_leave.portal_error', {
                'error': f'An unexpected error occurred: {str(e)}',
                'page_name': 'apply_leave',
            })

    @http.route('/my/leave/submit', type='http', auth='user', website=True, methods=['POST'], csrf=True)
    def submit_leave(self, **post):
        """Handle leave submission with comprehensive validation"""
        try:
            user = request.env.user

            # Get employee linked to portal user
            employee = request.env['hr.employee'].sudo().search([
                ('user_id', '=', user.id)
            ], limit=1)

            if not employee:
                _logger.error(f"No employee record found for user {user.login}")
                return request.redirect('/my/leave/apply?error=No employee record found. Please contact HR.')

            # Validate required fields
            date_from = post.get('date_from')
            date_to = post.get('date_to')
            leave_type_id = post.get('leave_type')
            reason = post.get('reason', '').strip()

            if not date_from or not date_to:
                return request.redirect('/my/leave/apply?error=Please provide both start and end dates')

            if not leave_type_id:
                return request.redirect('/my/leave/apply?error=Please select a leave type')

            if not reason:
                return request.redirect('/my/leave/apply?error=Please provide a reason for leave')

            # Convert to datetime objects
            try:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
            except ValueError as e:
                _logger.error(f"Date parsing error: {str(e)}")
                return request.redirect('/my/leave/apply?error=Invalid date format')

            # Date validations
            if date_from_obj > date_to_obj:
                return request.redirect('/my/leave/apply?error=Start date cannot be after end date')

            today = datetime.now().date()
            if date_from_obj < today:
                return request.redirect('/my/leave/apply?error=Cannot apply for past dates')

            # Validate leave type exists
            try:
                leave_type = request.env['hr.leave.type'].sudo().browse(int(leave_type_id))
                if not leave_type.exists():
                    _logger.error(f"Leave type {leave_type_id} not found")
                    return request.redirect('/my/leave/apply?error=Invalid leave type selected')
            except ValueError as e:
                _logger.error(f"Invalid leave_type_id: {leave_type_id}, error: {str(e)}")
                return request.redirect('/my/leave/apply?error=Invalid leave type')

            # Check for overlapping leaves
            overlapping = request.env['hr.leave'].sudo().search([
                ('employee_id', '=', employee.id),
                ('state', 'not in', ['refuse', 'cancel']),
                ('request_date_from', '<=', date_to),
                ('request_date_to', '>=', date_from),
            ])

            if overlapping:
                return request.redirect('/my/leave/apply?error=You already have a leave request for overlapping dates')

            # Check leave balance if allocation required
            if leave_type.requires_allocation != 'no':
                allocation = request.env['hr.leave.allocation'].sudo().search([
                    ('employee_id', '=', employee.id),
                    ('holiday_status_id', '=', leave_type.id),
                    ('state', '=', 'validate')
                ], limit=1)

                if allocation:
                    remaining = allocation.number_of_days - allocation.leaves_taken
                    requested_days = (date_to_obj - date_from_obj).days + 1

                    if remaining < requested_days:
                        return request.redirect(
                            f'/my/leave/apply?error=Insufficient leave balance. Available: {remaining} days')
                else:
                    return request.redirect('/my/leave/apply?error=No leave allocation found for this leave type')

            # Determine initial state based on team leader requirement
            initial_state = 'team_leader_approval' if employee.portal_team_leader_id else 'confirm'

            # Build leave values
            vals = {
                'employee_id': employee.id,
                'holiday_status_id': int(leave_type_id),
                'request_date_from': date_from,
                'request_date_to': date_to,
                'name': reason,
                'state': initial_state,  # THIS IS KEY!
            }

            _logger.info(f"Creating leave with state: {initial_state} (Team leader: {employee.portal_team_leader_id.name if employee.portal_team_leader_id else 'None'})")

            # Add delegation if provided
            delegate_id = post.get('delegate_employee_id')
            if delegate_id and delegate_id.strip() and delegate_id != 'None' and delegate_id != '':
                try:
                    delegate_id_int = int(delegate_id)
                    if delegate_id_int == employee.id:
                        return request.redirect('/my/leave/apply?error=You cannot delegate to yourself')

                    delegate_employee = request.env['hr.employee'].sudo().browse(delegate_id_int)
                    if delegate_employee.exists():
                        vals['delegate_employee_id'] = delegate_id_int
                        _logger.info(f"Delegation set to employee ID: {delegate_id_int}")
                    else:
                        _logger.warning(f"Invalid delegate employee ID: {delegate_id_int}")
                except ValueError as e:
                    _logger.warning(f"Invalid delegate_id value: {delegate_id}, error: {str(e)}")

            # Create leave request with sudo to bypass access restrictions
            try:
                leave = request.env['hr.leave'].sudo().create(vals)
                _logger.info(f"✓ Leave request created successfully: ID {leave.id}, State: {leave.state}, Team Leader Required: {bool(employee.portal_team_leader_id)}")
            except Exception as e:
                _logger.error(f"Error creating leave record: {str(e)}", exc_info=True)
                return request.redirect('/my/leave/apply?error=Failed to create leave request. Please try again.')

            if not leave:
                _logger.error("Leave creation returned False/None")
                return request.redirect('/my/leave/apply?error=Failed to create leave request')

            # Handle file attachment
            if 'attachment' in request.httprequest.files:
                attachment_file = request.httprequest.files['attachment']
                if attachment_file and attachment_file.filename:
                    try:
                        # Validate file size (max 5MB)
                        attachment_file.seek(0, 2)
                        file_size = attachment_file.tell()
                        attachment_file.seek(0)

                        if file_size > 5 * 1024 * 1024:
                            leave.sudo().unlink()
                            return request.redirect('/my/leave/apply?error=File size exceeds 5MB limit')

                        # Validate file type
                        allowed_extensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
                        file_ext = attachment_file.filename.split('.')[-1].lower()

                        if file_ext not in allowed_extensions:
                            leave.sudo().unlink()
                            return request.redirect(
                                '/my/leave/apply?error=Invalid file type. Allowed: PDF, DOC, DOCX, JPG, JPEG, PNG')

                        attachment_data = base64.b64encode(attachment_file.read())
                        request.env['ir.attachment'].sudo().create({
                            'name': attachment_file.filename,
                            'type': 'binary',
                            'datas': attachment_data,
                            'res_model': 'hr.leave',
                            'res_id': leave.id,
                            'mimetype': attachment_file.content_type,
                        })
                    except Exception as e:
                        _logger.error(f"Error uploading attachment: {str(e)}", exc_info=True)

            # Success message based on workflow
            success_message = 'Leave request submitted successfully'
            if initial_state == 'team_leader_approval':
                success_message += ' and is pending team leader approval'
            else:
                success_message += ' and is pending HR approval'

            return request.redirect(f'/my/leave/history?success={success_message}')

        except Exception as e:
            _logger.error(f"Unexpected error in submit_leave: {str(e)}", exc_info=True)
            return request.redirect('/my/leave/apply?error=An unexpected error occurred. Please try again or contact support.')

    @http.route('/my/leave/history', type='http', auth='user', website=True)
    def leave_history(self, **kw):
        """Display leave history with filters and pagination"""
        try:
            user = request.env.user

            # Get employee
            employee = request.env['hr.employee'].sudo().search([
                ('user_id', '=', user.id)
            ], limit=1)

            if not employee:
                return request.render('employee_portal_leave.portal_no_employee', {
                    'error': 'No employee record found',
                    'page_name': 'leave_history',
                })

            # ADD THIS: Check if user is a team leader
            team_members = request.env['hr.employee'].sudo().search([
                ('portal_team_leader_id', '=', employee.id),
                ('active', '=', True)
            ])
            is_team_leader = len(team_members) > 0

            # Count pending team approvals
            pending_team_count = 0
            if is_team_leader:
                pending_team_count = request.env['hr.leave'].sudo().search_count([
                    ('employee_id.portal_team_leader_id', '=', employee.id),
                    ('state', '=', 'team_leader_approval')
                ])
            # END ADD


            # Build domain for search
            domain = [('employee_id', '=', employee.id)]

            # Filter by status if provided
            status_filter = kw.get('status')
            if status_filter:
                domain.append(('state', '=', status_filter))

            # Get leaves with sudo()
            leaves = request.env['hr.leave'].sudo().search(
                domain,
                order='request_date_from desc, id desc'
            )

            # Get leave statistics
            all_leaves = request.env['hr.leave'].sudo().search([('employee_id', '=', employee.id)])
            stats = {
                'total': len(all_leaves),
                'pending': len(all_leaves.filtered(lambda l: l.state in ['confirm', 'team_leader_approval'])),
                'approved': len(all_leaves.filtered(lambda l: l.state == 'validate')),
                'refused': len(all_leaves.filtered(lambda l: l.state == 'refuse')),
                'draft': len(all_leaves.filtered(lambda l: l.state == 'draft')),
            }

            # Get leave allocations
            allocations = request.env['hr.leave.allocation'].sudo().search([
                ('employee_id', '=', employee.id),
                ('state', '=', 'validate')
            ])

            return request.render('employee_portal_leave.portal_leave_history', {
                'leaves': leaves,
                'stats': stats,
                'allocations': allocations,
                'status_filter': status_filter,
                'success': kw.get('success'),
                'error': kw.get('error'),
                'employee': employee,
                'page_name': 'leave_history',
                'is_team_leader': is_team_leader,  # ADD THIS
                'pending_team_count': pending_team_count,  # ADD THIS
            })

        except Exception as e:
            _logger.error(f"Error in leave_history: {str(e)}", exc_info=True)
            return request.render('employee_portal_leave.portal_error', {
                'error': f'An unexpected error occurred: {str(e)}',
                'page_name': 'leave_history',
            })

    @http.route('/my/leave/cancel/<int:leave_id>', type='http', auth='user', website=True, csrf=True)
    def cancel_leave(self, leave_id, **kw):
        """Cancel a pending leave request"""
        try:
            leave = request.env['hr.leave'].sudo().browse(leave_id)

            if not leave.exists():
                return request.redirect('/my/leave/history?error=Leave request not found')

            if leave.employee_id.user_id.id != request.env.user.id:
                return request.redirect('/my/leave/history?error=Unauthorized access')

            # Allow cancellation of draft, pending, or team_leader_approval
            if leave.state not in ['draft', 'confirm', 'team_leader_approval']:
                return request.redirect(
                    '/my/leave/history?error=Cannot cancel this leave request. Current status does not allow cancellation')

            leave.sudo().action_refuse()
            _logger.info(f"Leave request {leave_id} cancelled by user {request.env.user.name}")

            return request.redirect('/my/leave/history?success=Leave request cancelled successfully')

        except Exception as e:
            _logger.error(f"Error in cancel_leave: {str(e)}", exc_info=True)
            return request.redirect(f'/my/leave/history?error=Error cancelling leave request')

    @http.route('/my/leave/team-approvals', type='http', auth='user', website=True)
    def team_leader_approvals(self, **kw):
        """Display leaves pending team leader approval - ONLY for actual team leaders"""
        try:
            user = request.env.user

            # Get employee
            employee = request.env['hr.employee'].sudo().search([
                ('user_id', '=', user.id)
            ], limit=1)

            if not employee:
                return request.render('employee_portal_leave.portal_no_employee', {
                    'error': 'No employee record found',
                    'page_name': 'team_approvals',
                })

            # CHECK: Is this user actually a team leader?
            team_members = request.env['hr.employee'].sudo().search([
                ('portal_team_leader_id', '=', employee.id),
                ('active', '=', True)
            ])

            if not team_members:
                return request.render('employee_portal_leave.portal_not_team_leader', {
                    'error': 'You are not assigned as a team leader.',
                    'page_name': 'team_approvals',
                })

            _logger.info(f"✓ Team leader {employee.name} accessing approvals page. Team size: {len(team_members)}")

            # Get leaves where current user is team leader
            pending_leaves = request.env['hr.leave'].sudo().search([
                ('employee_id.portal_team_leader_id', '=', employee.id),
                ('state', '=', 'team_leader_approval')
            ], order='request_date_from desc')

            # Get all leaves for this team leader (history)
            all_team_leaves = request.env['hr.leave'].sudo().search([
                ('employee_id.portal_team_leader_id', '=', employee.id)
            ], order='request_date_from desc')

            stats = {
                'pending': len(pending_leaves),
                'total': len(all_team_leaves),
                'approved': len(all_team_leaves.filtered(lambda l: l.team_leader_approved)),
                'team_members': len(team_members),
            }

            _logger.info(f"Team leader stats: {stats}")

            return request.render('employee_portal_leave.portal_team_leader_approvals', {
                'pending_leaves': pending_leaves,
                'all_leaves': all_team_leaves,
                'team_members': team_members,
                'stats': stats,
                'success': kw.get('success'),
                'error': kw.get('error'),
                'employee': employee,
                'page_name': 'team_approvals',
            })

        except Exception as e:
            _logger.error(f"Error in team_leader_approvals: {str(e)}", exc_info=True)
            return request.render('employee_portal_leave.portal_error', {
                'error': f'An unexpected error occurred: {str(e)}',
                'page_name': 'team_approvals',
            })

    @http.route('/my/leave/team-leader/approve/<int:leave_id>', type='http', auth='user', website=True, csrf=True)
    def team_leader_approve_leave(self, leave_id, **kw):
        """Team leader approves a leave request"""
        try:
            employee = request.env['hr.employee'].sudo().search([
                ('user_id', '=', request.env.user.id)
            ], limit=1)

            if not employee:
                return request.redirect('/my/leave/team-approvals?error=No employee record found')

            leave = request.env['hr.leave'].sudo().browse(leave_id)

            if not leave.exists():
                return request.redirect('/my/leave/team-approvals?error=Leave request not found')

            # Verify authorization
            if not leave.employee_id.portal_team_leader_id:
                return request.redirect('/my/leave/team-approvals?error=This leave has no team leader assigned')

            if leave.employee_id.portal_team_leader_id.id != employee.id:
                _logger.warning(f"Unauthorized: {employee.name} tried to approve {leave.employee_id.name}'s leave")
                return request.redirect('/my/leave/team-approvals?error=You are not authorized to approve this request')

            if leave.state != 'team_leader_approval':
                return request.redirect('/my/leave/team-approvals?error=This leave is not pending your approval')

            # Approve
            leave.action_team_leader_approve()
            _logger.info(f"✓ Team leader {employee.name} approved leave {leave_id}")

            return request.redirect('/my/leave/team-approvals?success=Leave request approved successfully')

        except Exception as e:
            _logger.error(f"Error in team_leader_approve_leave: {str(e)}", exc_info=True)
            return request.redirect(f'/my/leave/team-approvals?error=Error approving leave request')

    @http.route('/my/leave/team-leader/refuse/<int:leave_id>', type='http', auth='user', website=True, csrf=True)
    def team_leader_refuse_leave(self, leave_id, **kw):
        """Team leader refuses a leave request"""
        try:
            employee = request.env['hr.employee'].sudo().search([
                ('user_id', '=', request.env.user.id)
            ], limit=1)

            if not employee:
                return request.redirect('/my/leave/team-approvals?error=No employee record found')

            leave = request.env['hr.leave'].sudo().browse(leave_id)

            if not leave.exists():
                return request.redirect('/my/leave/team-approvals?error=Leave request not found')

            # Verify authorization
            if not leave.employee_id.portal_team_leader_id:
                return request.redirect('/my/leave/team-approvals?error=This leave has no team leader assigned')

            if leave.employee_id.portal_team_leader_id.id != employee.id:
                _logger.warning(f"Unauthorized: {employee.name} tried to refuse {leave.employee_id.name}'s leave")
                return request.redirect('/my/leave/team-approvals?error=You are not authorized to refuse this request')

            if leave.state != 'team_leader_approval':
                return request.redirect('/my/leave/team-approvals?error=This leave is not pending your approval')

            # Refuse
            leave.action_team_leader_refuse()
            _logger.info(f"✓ Team leader {employee.name} refused leave {leave_id}")

            return request.redirect('/my/leave/team-approvals?success=Leave request refused')

        except Exception as e:
            _logger.error(f"Error in team_leader_refuse_leave: {str(e)}", exc_info=True)
            return request.redirect(f'/my/leave/team-approvals?error=Error refusing leave request')

    @http.route('/my/leave/balance/<int:leave_type_id>', type='json', auth='user')
    def get_leave_balance(self, leave_type_id):
        """Get remaining leave balance for a specific leave type"""
        try:
            employee = request.env['hr.employee'].sudo().search([
                ('user_id', '=', request.env.user.id)
            ], limit=1)

            if not employee:
                return {'error': 'No employee record found'}

            allocation = request.env['hr.leave.allocation'].sudo().search([
                ('employee_id', '=', employee.id),
                ('holiday_status_id', '=', int(leave_type_id)),
                ('state', '=', 'validate')
            ])

            if allocation:
                total = sum(allocation.mapped('number_of_days'))
                used = sum(allocation.mapped('leaves_taken'))
                return {
                    'success': True,
                    'total': total,
                    'used': used,
                    'remaining': total - used
                }

            return {
                'success': True,
                'total': 0,
                'used': 0,
                'remaining': 0,
                'message': 'No allocation found'
            }

        except Exception as e:
            _logger.error(f"Error in get_leave_balance: {str(e)}", exc_info=True)
            return {'error': str(e)}