/** @odoo-module **/

import searchExports from '@website/snippets/s_searchbar/000';
import { rpc } from "@web/core/network/rpc";
import { B2bMixin } from '@theme_prime/js/core/mixins';
import { isMobileOS } from "@web/core/browser/feature_detection";
import { markup } from "@odoo/owl";

let {searchBar} = searchExports;


searchBar.include(Object.assign({}, B2bMixin, {

    events: Object.assign({}, searchBar.prototype.events, {
        'click a[data-type]': '_onClickSearchResult',
        'submit.o_searchbar_form': '_onSubmitSearchResult',
    }),
    init: function () {
        this._super.apply(this, arguments);
        this.notification = this.bindService("notification");
        this.advanceMode = odoo.dr_theme_config.json_product_search.advance_search;
        this.search_reports = odoo.dr_theme_config.json_product_search.search_report;
        this.pill_style = odoo.dr_theme_config.json_shop_category_pills.style;
    },

    start: function () {
        this._super.apply(this, arguments);
        this.single_column = isMobileOS() || this.$el.hasClass('dr_in_sidebar');
    },

    async _fetch() {
        this.isB2bActive = this._isB2bModeEnabled();
        if (this.advanceMode) {
            this.searchType = 'droggol';
            const res = await rpc('/website/dr_search', {
                'term': this.$input.val(),
                'max_nb_chars': Math.round(Math.max(this.autocompleteMinWidth, parseInt(this.$el.width())) * 0.22),
                'options': this.options,
                'device_type': isMobileOS() ? 'mobile': 'desktop',
            });

            if (this.search_reports) {
                this.searchReportData = {
                    'search_term': this.$input.val(),
                    'category_count': res.categories.results.length,
                    'product_count': res.products.results.length,
                    'autocomplete_count': res.autocomplete.results_count,
                    'suggestion_count': res.suggestions.results_count,
                }
            }

            this._markupRecords(res.products.results);
            this._markupRecords(res.categories.results);
            this._markupRecords(res.brands.results);
            this._markupRecords(res.suggestions.results);
            this._markupRecords(res.autocomplete.results);
            if (res.global_match) {
                res.global_match['name'] = markup(res.global_match['name'])
            }
            this.results = res || {};
            return res
        } else {
            return this._super.apply(this, arguments);
        }
    },

    _markupRecords: function (results) {
        const fieldNames = ['name', 'description', 'extra_link', 'detail', 'detail_strike', 'detail_extra'];
        results.forEach(record => {
            for (const fieldName of fieldNames) {
                if (record[fieldName]) {
                    if (typeof record[fieldName] === "object") {
                        for (const fieldKey of Object.keys(record[fieldName])) {
                            record[fieldName][fieldKey] = markup(record[fieldName][fieldKey]);
                        }
                    } else {
                        record[fieldName] = markup(record[fieldName]);
                    }
                }
            }
        });
    },

    _onKeydown: function (ev) {
        if ((ev.key === "ArrowUp" || ev.key === "ArrowDown") && this.$menu && this.advanceMode) {
            ev.preventDefault();
            const focusableEls = [this.$input[0], ...[...this.$menu[0].children].filter((item) => { return item.classList.contains('dropdown-item')})];
            const focusedEl = document.activeElement;
            const currentIndex = focusableEls.indexOf(focusedEl) || 0;
            const delta = ev.key === "ArrowUp" ? focusableEls.length - 1 : 1;
            const nextIndex = (currentIndex + delta) % focusableEls.length;
            const nextFocusedEl = focusableEls[nextIndex];
            nextFocusedEl.focus();
        } else { this._super.apply(this, arguments); }
    },

    _addSearchReport: function (searchReportData) {
        searchReportData['device_type'] = isMobileOS() ? 'mobile': 'desktop';
        rpc('/website/dr_search/add_report', searchReportData);
    },

    _onClickSearchResult: function (ev) {
        if (this.search_reports) {
            var $searchResult = $(ev.currentTarget);
            var search_type = $searchResult.data('type');
            this.searchReportData['clicked_type'] = search_type;
            this.searchReportData['clicked_href'] = $searchResult.attr('href');
            if (search_type == 'product') {
                this.searchReportData['clicked_string'] = $searchResult.find('.h6').text().trim();
            } else {
                this.searchReportData['clicked_string'] = $searchResult.text().trim();
            }
            this._addSearchReport(this.searchReportData);
        }
    },

    _onSubmitSearchResult: function (ev) {
        if (this.search_reports) {
            let searchReportData = {
                "search_term": this.$input.val(),
                "clicked_type": "submit",
            }
            this._addSearchReport(searchReportData);
        }
    },

}));

export default {
    searchBar: searchBar,
};
