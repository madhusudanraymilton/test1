{
    'name': 'Employee Portal Leave Management',
    'version': '1.3.0',
    'category': 'Human Resources/Time Off',
    'summary': 'Secure leave management portal for employees with auto-linking',
    'description': """
        Employee Portal Leave Management
        =================================
        This module allows portal users to:
        * Apply for time off/leaves with modern interface
        * View leave balance in real-time
        * Track leave request status with visual indicators
        * Delegate work during leave
        * Upload supporting documents (max 5MB)
        * Cancel pending requests
        * Filter leave history by status
        * Responsive design for mobile/tablet/desktop

        Security Features (v1.3):
        * Auto-create employee records for new portal users
        * Strict access control - portal users can ONLY see their own leaves
        * No access to other employees' data
        * No access to HR configurations
        * Bulk wizard to link existing portal users to employees
        * HR admin helper to manually create employee records

        Features:
        * Modern Bootstrap 5 design
        * Real-time form validation
        * Auto-calculation of leave duration
        * Balance checking before submission
        * File upload with validation
        * Email notifications (optional)
        * Comprehensive error handling
        * Detailed audit logging

        Technical Improvements:
        * Enhanced security with proper access rights and record rules
        * CSRF protection
        * SQL injection prevention
        * Optimized database queries
        * Client-side and server-side validation
        * Proper error handling and logging
        * Auto-linking portal users to employees
    """,
    'author': 'BdCalling It Lt.',
    'website': 'https://www.bdcalling.com',
    'depends': [
        'website',
        'portal',
        'hr_holidays',
        'hr',
    ],
    'data': [
        'security/portal_leave_security.xml',
        'security/ir.model.access.csv',
        'views/wizard_link_portal_employee_views.xml',
        'views/portal_apply_leave.xml',
        'views/portal_leave_history.xml',
        'views/portal_team_leader_approvals.xml', # ADD THIS LINE NEW
        'views/hr_leave_views.xml',
        'views/hr_employee_views.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'employee_portal_leave/static/src/css/leave_portal.css',
            'employee_portal_leave/static/src/js/leave_portal.js',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}