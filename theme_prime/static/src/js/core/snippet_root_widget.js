/** @odoo-module **/

import { primeUtilities } from "@theme_prime/js/core/mixins";
import publicWidget from "@web/legacy/js/public/public_widget";
import { debounce, throttleForAnimation } from "@web/core/utils/timing";
import { utils as uiUtils } from "@web/core/ui/ui_service";
import { renderToElement, renderToString } from "@web/core/utils/render";
import { rpc } from "@web/core/network/rpc";
import { _t } from "@web/core/l10n/translation";
import { markup } from "@odoo/owl";
import { closestScrollable } from "@web_editor/js/common/scrolling";

const ThemePrimeRootWidget = publicWidget.Widget.extend(primeUtilities, {
    disabledInEditableMode: false,
    controllerRoute: false,
    fieldstoFetch: false,
    bodyTemplate: false,
    templateRenderToString: false,
    bodySelector: false,
    displayLoader: true,
    snippetNodeAttrs: [],
    extraLibs: [],
    IsAttrSet: false,

    // Droggol's attributs :)
    noDataTemplate: 'droggol_default_no_data_templ',
    noDataTemplateImg: '/theme_prime/static/src/img/no_data.svg',
    noDataTemplateString: _t("No products found!"),
    noDataTemplateSubString: _t("Sorry, We couldn't find any products"),
    displayAllProductsBtn: true,
    loaderTemplate: 'droggol_default_loader',
    isMobile: uiUtils.isSmall(),

    init: function () {
        this._super.apply(this, arguments);
        this.notification = this.bindService("notification");
    },

    /**
     * @override
     */
    start: function () {
        let defs = [this._super.apply(this, arguments)];
        // Remove this code in next version
        if (
            this.$target.hasClass('droggol_product_snippet') ||
            this.$target.hasClass('tp-dynamic-snippet') ||
            this.$target.hasClass('tp-droggol-dynamic-snippet') ||
            this.$target.hasClass('tp-droggol-builder-snippet')
        ) {
            this._renderAndAppendQweb('tp_block_deprecated_notice', 'tp_block_deprecated_notice', true);
            return Promise.all(defs);
        }

        this._setCamelizeAttrs();

        if (!this.IsAttrSet && this.$target.hasClass('tp-mega-menu-snippet')) {
            return Promise.all(defs);
        }

        if (!this._isSnippetVisible() && !this.editableMode) {
            this.$target[0].classList.add('d-none');
            return Promise.all(defs);
        }

        this.$target[0].classList.remove('d-none');

        let params = this._getParameters();
        if (this.controllerRoute && Object.keys(params).length) {
            if (this.fieldstoFetch) {
                params = { ...params, ...{ fields: this._getFieldsList() } };
            }
            this._onResizeChange = debounce(this._onWindowResize, 100);
            $(window).resize(() => {
                this._onResizeChange();
            });
            let def = this._renderPrimeTemplate(params);
            if (!this._isPublicUser()) {
                defs.push(def);
            }
            return Promise.all(defs);
        }
        return Promise.all(defs);
    },

    /**
    * @override
    */
    destroy: function () {
        if (!this.IsAttrSet && this.$target.hasClass('tp-mega-menu-snippet')) {
            return this._super.apply(this, arguments);
        }
        this.options.wysiwyg && this.options.wysiwyg.odooEditor.observerUnactive();
        this._super.apply(this, arguments);
        this._modifyElementsBeforeRemove();
        this._getBodySelectorElement().empty();
        this.options.wysiwyg && this.options.wysiwyg.odooEditor.observerActive();
    },

    /**
     * No need to return promise here for the moment we are not using it anywhere but we might need it in future :)
     */
    _reloadWidget: async function (data) {
        let { selector, target } = data;
        if (!target && selector && !this.$target.find(selector).length) {
            return;
        } else {
            target = target ? target : this.$target.find(selector);
        }
        return new Promise((resolve, reject) => {
            this.trigger_up('widgets_start_request', {
                editableMode: this.editableMode,
                $target: target,
                onSuccess: resolve,
                onFailure: reject,
            });
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
    * @private
    */
    _appendLoader: function () {
        if (this.displayLoader && this.loaderTemplate) {
            this._renderAndAppendQweb(this.loaderTemplate, 'd_loader_default', true);
        }
    },

    /**
     * @private
     */
    _appendNoDataTemplate: function () {
        if (this.noDataTemplate) {
            this._renderAndAppendQweb(this.noDataTemplate, 'd_no_data_tmpl_default', true);
        }
    },

    /**
     * @private
     */
    _cleanBeforeAppend: function () {
        // Remove unecessary elements
        this.$('.d_loader_default').remove();
        this.$('.d_no_data_tmpl_default').remove();
        this.$('.d_editor_tmpl_default').remove();
    },

    /**
     * @private
     */
    _cleanAttributes: function () {
        if (this._isPublicUser()) {
            this.snippetNodeAttrs.forEach(attr => {
                this.$target.removeAttr(attr);
            });
        }
    },

    _markUpResults: function (result) {
        return markup(result);
    },

    // Funny hack
    JaysonStringify: function (data) {
        return JSON.stringify(data);
    },

    /**
     * @private
     */
    _isElementInViewport: function () {
        let _scrollElement = closestScrollable(this.$target.get(0));
        var windowHeight = $().getScrollingTarget(_scrollElement)[0].innerHeight;
        return (this.$target.get(0).getBoundingClientRect().top - windowHeight) < 350;
    },

    _isSnippetVisible: function () {
        if (!this?.extraInfo || Object.keys(this.extraInfo).length === 0) {
            return true;
        }
        const isCorrectPricelist = ["*", parseInt(document.documentElement.dataset.pricelistId)]
            .includes(this?.extraInfo?.priceList);
        const startTime = this?.extraInfo?.startDate;
        const endTime = this?.extraInfo?.endDate;
        const isCorrectStartTime = startTime ? this._isMyTimeHasCome(startTime) : true;
        const isCorrectEndTime = endTime ? !this._isMyTimeHasCome(endTime) : true;
        if (isCorrectPricelist && isCorrectStartTime && isCorrectEndTime) {
            return true;
        }
        return false;
    },

    /**
     * @private
     */
    _getBodySelectorElement: function () {
        let selector = this.bodySelector;
        return selector ? this.$(selector) : this.$target;
    },

    /**
    * @private
    */
    _getDomain: function () {
        return false;
    },

    /**
    * @private
    * Master Oogway
    */
    _isMyTimeHasCome: function (dueDate) {
        if (!dueDate) { return true; }
        let eventTime = luxon.DateTime.now();
        if (dueDate.includes("-")) {
            eventTime = deserializeDateTime(dueDate);
        } else {
            eventTime = luxon.DateTime.fromISO(new Date(parseInt(dueDate) * 1000).toISOString());
        }
        return !(Math.floor(eventTime.diffNow().as("seconds")) > 0);
    },

    /**
    * @private
    */
    _getFieldsList: function () {
        return this.fieldstoFetch;
    },

    /**
    * @private
    */
    _getLimit: function () {
        return false;
    },

    /**
     * @private
     */
    _getOptions: function () {
        return false;
    },

    /**
     * @private
     */
    _getSortBy: function () {
        return false;
    },

    /**
     * @private
     */
    _getParameters: function () {
        let domain = this._getDomain();
        let params = {};
        if (domain) {
            params['domain'] = domain;
        }
        let limit = this._getLimit();
        if (limit !== false) {
            params['limit'] = limit;
        }
        let order = this._getSortBy();
        if (order) {
            params['order'] = order;
        }
        let options = this._getOptions();
        if (options) {
            params['options'] = options;
        }
        return params;
    },

    /**
     * @private
     */
    _isPublicUser: function () {
        return odoo.dr_theme_config.hasOwnProperty("is_public_user") && odoo.dr_theme_config.is_public_user;
    },

    /**
     * @private
     */
    _onSuccessResponse: function (response) {
        let hasData = this._responseHasData(response);
        if (hasData) {
            this._setDBData(response);
            this._renderContent(this._processData(response));
        } else {
            this._appendNoDataTemplate();
        }
    },

    /**
     * @private
     */
    _fetchData: async function (params) {
        return await rpc(this.controllerRoute, params);
    },

    /**
     * @private
     *
     * On mobile, we **do not** attach any scroll listeners.
     * The Promise resolves immediately so snippets fetch once and never
     * reload on scroll. Desktop keeps the original lazy-load behavior.
     */
    _isReadyToFetch: async function () {
        this.$megaMenu = this.$el.closest('.dropdown');
        return new Promise((resolve, reject) => {
            // ✅ MOBILE FIX: no lazy scroll loading on small screens
            if (uiUtils.isSmall()) {
                resolve();
                return;
            }

            let _scrollElement = closestScrollable(this.$target.get(0));
            this.$relativeTarget = $($().getScrollingTarget(_scrollElement)[0]);
            let position = this.$relativeTarget.scrollTop();

            if (this.$megaMenu.length) {
                // throttle needed otherwise sometimes it's crash the chrome :)
                this.$megaMenu.on(
                    'show.bs.dropdown show.tp.dropdown',
                    throttleForAnimation(ev => { resolve(); }, 200)
                );
            } else {
                this.$relativeTarget.on(
                    'scroll.snippet_root_scroll',
                    throttleForAnimation(ev => {
                        const scroll = this.$relativeTarget.scrollTop();
                        if (scroll > position) {
                            // Trigger only when scrollDown
                            if (this._isElementInViewport(this.target)) {
                                resolve();
                            }
                        }
                        position = scroll;
                    }, 200)
                );
            }
        });
    },

    /**
     * @private
     */
    _modifyElementsBeforeRemove: function () {},

    /**
     * @private
     */
    _modifyElementsAfterAppend: function () {
        this.$('.d_body_tmpl_default').removeClass('d_body_tmpl_default');
        this._cleanAttributes();
    },

    /**
     * @private
     */
    _processData: function (data) {
        return data;
    },

    /**
     * @private
     */
    _responseHasData: function (data) {
        return data;
    },

    /**
     * @private
     */
    _setCamelizeAttrs: function () {
        let snippetNodeAttrs = this.snippetNodeAttrs;
        snippetNodeAttrs.forEach(attr => {
            let str = attr.startsWith('data-') ? attr.split('data-') : attr;
            let arr = str[1].split('-');
            let capital = arr.map((item, index) =>
                index ? item.charAt(0).toUpperCase() + item.slice(1).toLowerCase() : item.toLowerCase()
            );
            // If you didn't get this thing then ask to boy Kishan Gajjar (kig-odoo)
            let capitalString = capital.join("");
            let attrVal = this.$target.get(0).dataset[capitalString];
            this[capitalString] = attrVal !== undefined ? JSON.parse(attrVal) : false;
            this[`${capitalString}_init`] = attrVal !== undefined ? JSON.parse(attrVal) : false;
            if (this[capitalString]) {
                this.IsAttrSet = true;
            }
        });
    },

    /**
     * @private
     * override to set values to widget
     */
    _setDBData: function (data) {},

    /**
     * @private
     */
    _renderAndAppendQweb: function (template, className, data) {
        // observer shit needed but wait for someone to report a bug don't want to spread shit here
        if (!template || !data) {
            // for safety
            return;
        }
        const renderAs = this.templateRenderToString ? renderToString : renderToElement;
        let $template = $(renderAs(template, { data, widget: this }));
        $template.addClass(className);
        // html() make sure template appends only once.
        this._getBodySelectorElement().html($template);
    },

    /**
     * @private
     */
    _renderContent: function (data) {
        // Should remove this below observer shit someday we need to rework on few things.
        this.options.wysiwyg && this.options.wysiwyg.odooEditor.observerUnactive();
        this._cleanBeforeAppend();
        this._renderAndAppendQweb(this.bodyTemplate, 'd_body_tmpl_default', data);
        this._modifyElementsAfterAppend();
        this.options.wysiwyg && this.options.wysiwyg.odooEditor.observerActive();
    },

    /**
    * @private
    */
    _onWindowResize: function () {},

    /**
     * @private
     * Happy debugging suckers
     * Just like Po unlocking his inner Dragon Warrior
     */
    _renderPrimeTemplate: async function (params) {
        // Lazy load only for public user AND desktop/tablet
        if (
            this.$target.hasClass('tp-snippet-shiftless-enable') &&
            this._isPublicUser() &&
            !uiUtils.isSmall()
        ) {
            await this._isReadyToFetch();
        }
        // for safety to avoid crash
        let [response, anotherResult] = await Promise.all([
            this._fetchData(params),
            this._primeLoadExtras(this._appendLoader.bind(this)),
        ]);
        this.response = response;
        this._onSuccessResponse(response);
        return response;
    },
});

publicWidget.registry.tp_root_widget = ThemePrimeRootWidget;

export default ThemePrimeRootWidget;
