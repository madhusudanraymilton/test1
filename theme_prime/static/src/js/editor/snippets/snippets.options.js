/** @odoo-module **/

import options from "@web_editor/js/editor/snippets.options";
import { registry } from "@web/core/registry";
import { TpSnippetConfigDialog } from "@theme_prime/components/dialog";
import { MediaDialog } from "@web_editor/components/media_dialog/media_dialog";
import { rpc } from "@web/core/network/rpc";
import { loadImageInfo } from "@web_editor/js/editor/image_processing";
import { throttleForAnimation } from "@web/core/utils/timing";
import { uniqueId } from "@web/core/utils/functions";
import { renderToElement } from "@web/core/utils/render";
import { _t } from "@web/core/l10n/translation";

    options.registry.s_tp_documents_snippet = options.Class.extend({
        /**
        * @override
        */
        start: function () {
            this.$target.on('click', '.tp_add_documents', ev => { this.manageDocuments(); });
            return this._super.apply(this, arguments);
        },

        //--------------------------------------------------------------------------
        // Options
        //--------------------------------------------------------------------------

        manageDocuments: function (previewMode, value, $opt) {
            this.call("dialog", "add", MediaDialog, {
                noIcons: true,
                noVideos: true,
                noImages: true,
                res_model: 'ir.ui.view',
                save: image => {
                    let documentInfo = {
                        mimetype: image.dataset.mimetype,
                        url: image.href,
                        name: image.title,
                    }
                    this._appendDocument(documentInfo);
                }
            });
        },
        _appendDocument: function (documentInfo) {
            this.$('.alert.alert-info').remove();
            this.$target.find('.s_tp_documents_snippet_row').append($(renderToElement('theme_prime.s_tp_documents_snippet_template', { documentInfo: documentInfo })));
        },
    });
    options.registry.TpImageHeightWidth = options.Class.extend({
        toggleHeightWidth(previewMode, widgetValue, params) {
            const widgetVal = widgetValue ? JSON.parse(widgetValue) : false;
            if (!widgetVal) {
                this.$target.get(0).removeAttribute("height");
                this.$target.get(0).removeAttribute("width");
            }
            this.$target.toggleClass('tp-height-width-enable', widgetVal);
        },
        /**
         * @override
         */
        _computeWidgetVisibility(widgetName, params) {
            switch (widgetName) {
                case 'dr_width_option':
                case 'dr_height_option': {
                    return this.$target.get(0).classList.contains('tp-height-width-enable');
                }
            }
            return this._super(...arguments);
        },
        /**
         * @override
         */
        _computeWidgetState: function (methodName, params) {
            if (methodName === 'toggleHeightWidth') {
                return this.$target.get(0).classList.contains('tp-height-width-enable');
            }
            return this._super(...arguments);
        },
    });
    options.registry.TpImageHotspot = options.Class.extend({
        /**
         * @constructor
         */
        init() {
            this._super(...arguments);
            this._rpc = options.serviceCached(rpc);
        },
        /**
         * @override
         */
        start() {
            this.$target.on('image_changed.TpImageHotspot', this._onImgChanged.bind(this));
            return this._super(...arguments);
        },
        /**
         * @override
         */
        async willStart() {
            const _super = this._super.bind(this);
            await this._loadAttachmentInfo();
            return _super(...arguments);
        },
        /**
         * @override
         */
        destroy() {
            this.$target.off('.TpImageHotspot');
            return this._super(...arguments);
        },
        /**
         * Loads the image's attachment info.
         *
         * @private
         */
        async _loadAttachmentInfo() {
            const img = this._getImage();
            // Used 'loadImageInfo' here thanks to image processing mechanism
            // You know i'm saying thank you to myself :) i've developed image processing logic for the cropimage feature in 2018.
            // https://github.com/odoo/odoo/commit/d66e260391ce6c55b55be358202fddfab4a9139d
            await loadImageInfo(img, this._rpc.call.bind(this));
            if (!img.dataset.originalId) {
                this.originalId = null;
                this.originalSrc = null;
                return;
            }
            this.originalId = img.dataset.originalId;
            this.originalSrc = img.dataset.originalSrc;
        },
        /**
         * @private
         */
        async _autoUpdateImage() {
            await this._loadAttachmentInfo();
            await this.updateUI();
        },
        /**
         * No need to write comment here Method name says everything.
         *
         * @private
         */
        toggleImgHotspot(previewMode, widgetValue, params) {
            const widgetVal = widgetValue ? JSON.parse(widgetValue) : false;
            if (widgetVal) {
                this.$target.wrap("<div class='d-flex tp-img-hotspot-wrapper'><div class='position-relative tp-hotspot-container d-inline-block'></div></div>");
                // center image must remain in center
                if (this.$target.hasClass('mx-auto')) {
                    let $target = this._getHotSpotWrapper();
                    $target.find('.tp-hotspot-container').addClass('mx-auto');
                }
            } else if (this._getHotSpotWrapper().length) {
                this._cleanHotspotNode();
            }
            // toggleClass at last so _cleanHotspotNode method have correct state
            this.$target.toggleClass('tp-img-hotspot-enable', widgetVal);
        },
        /**
         * @override
         */
        _computeVisibility() {
            const img = this._getImage();
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(img.dataset.mimetype)) {
                this._cleanHotspotNode();
                return false;
            }
            const src = img.getAttribute('src');
            return src && src !== '/';
        },

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * Add Pointer.
         *
         * @private
         */
        addHotspot(previewMode, widgetValue, params) {
            const hotspotID = uniqueId('tphotspot');
            let $wrapper = $(this._getHotSpotWrapper().find('.tp-hotspot-container'));
            const selector = `#${hotspotID}`;
            $wrapper.append($('<span/>', { 'id': hotspotID, 'class': 'tp_hotspot tp_hotspot_style_1 tp-hotspot-primary position-absolute', 'style': 'top:50%;left:50%;' }));
            let $snippet = $wrapper.find(selector);
            let values = { hotspotType: 'static', titleText: "Your title", subtitleText: "Theme prime is best theme", buttonLink: '/', buttonText: 'SHOP NOW', imageSrc: '/theme_prime/static/src/img/s_config_data.png' };
            this._setDefaultValues($snippet, values);
            this.trigger_up('activate_snippet', { $snippet: $snippet });
        },
        /**
         * Add Pointer.
         *
         * @private
         */
        _cleanHotspotNode() {
            if (this._isHotspotEnable()) {
                this._getHotSpotWrapper().find('.tp_hotspot').remove();
                this.$target.removeClass('tp-img-hotspot-enable');
                this.$target.unwrap().unwrap();
            }
        },
        /**
         * Returns the image that is currently being modified.
         *
         * @private
         * @returns {HTMLImageElement} the image to use for modifications
         */
        _getImage() {
            return this.$target[0];
        },
        /**
         * Returns wrapper.
         *
         * @private
         */
        _getHotSpotWrapper: function () {
            return this.$target.parents('.tp-img-hotspot-wrapper');
        },
        /**
         * @override
         */
        _computeWidgetState: function (methodName, params) {
            if (methodName === 'toggleImgHotspot') {
                return this._isHotspotEnable();
            }
            return this._super(...arguments);
        },
        /**
         * @override
         */
        _computeWidgetVisibility: function (widgetName, params) {
            switch (widgetName) {
                case 'add_hotspot': {
                    return this._isHotspotEnable();
                }
            }
            return this._super(...arguments);
        },
        /**
         * @private
         */
        _isHotspotEnable: function () {
            return this.$target.hasClass('tp-img-hotspot-enable');
        },
        /**
         * @private
         */
        _setDefaultValues($snippet, values) {
            Object.keys(values).forEach(key => {
                $snippet[0].dataset[key] = values[key];
            });
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Must need to reload image :)
         *
         * @private
         * @param {Event} ev
         */
        async _onImgChanged(ev) {
            this.trigger_up('snippet_edition_request', {
                exec: async () => {
                    await this._autoUpdateImage();
                }
            });
        },
    });
    options.registry.AddToCart = options.registry.AddToCart.extend({
        // sometimes i want to ask questions to Odoo team why :(
        _buttonEl() {
            let buttonEl = this._super(...arguments);
            buttonEl.classList.remove('btn-secondary');
            buttonEl.classList.add('btn-primary');
            return buttonEl;
        },
    });
    options.registry.MegaMenuLayout = options.registry.MegaMenuLayout.extend({
        /**
         * @override
         * Stupid Odoo sh*t
         * hide sync categories options from panel
         */
        _computeWidgetVisibility: function (methodName, params) {
            let opt = this.$el.get(0);
            if (methodName === 'fetch_ecom_categories_opt' && opt) {
                if (this.containerEl.querySelector('section').classList.contains('s_no_category_sync')) {
                    opt.classList.add('tp-hide-categories-opt');
                    return true;
                }
                opt.classList.remove('tp-hide-categories-opt');
                return true;
            }
            return this._super(...arguments);
        },
    });
    options.registry.TpImageHotspotConfig = options.Class.extend({
        // Product widget is for dropdownTemplate in select2
        // xmlDependencies: ['/theme_prime/static/src/xml/frontend/image_hotspot.xml', '/theme_prime/static/src/xml/editor/widgets/products_widget.xml'],
        /**
         * @override
         */
        start: function () {
            this.rangeWidgetTopId = uniqueId('rangeWidgetTop');
            this.rangeWidgetLeftId = uniqueId('rangeWidgetLeftId');
            this.$el.find('we-range[data-set-top] input[type="range"]').on(`input.${this.rangeWidgetTopId}`, throttleForAnimation((ev) => { this.setTop(true, $(ev.currentTarget).val()) }, 50));
            this.$el.find('we-range[data-set-left] input[type="range"]').on(`input.${this.rangeWidgetLeftId}`, throttleForAnimation((ev) => { this.setLeft(true, $(ev.currentTarget).val()) }, 50));
            this.PreviewEnabled = false;
            return this._super.apply(this, arguments);
        },
        /**
         * @override
         */
        destroy: function () {
            this._super.apply(this, arguments);
            if (!this.$target.height()) {
                this._removeTpPopover(true);
            }
            this.$el.find('we-range[data-set-top] input[type="range"]').off(`.${this.rangeWidgetTopId}`);
            this.$el.find('we-range[data-set-left] input[type="range"]').off(`.${this.rangeWidgetLeftId}`);
        },

        //--------------------------------------------------------------------------
        // Options
        //--------------------------------------------------------------------------

        /**
         * @private
         */
        setHotspotType(previewMode, widgetValue, params) {
            this._removeTpPopover();
            // Clean Attrs for other type
            if (widgetValue === 'dynamic' && !this.$target[0].dataset['onHotspotClick']) {
                this.$target[0].dataset['onHotspotClick'] = 'popover';
            }
        },
        /**
        * @private
        */
        setTitleText(previewMode, widgetValue, params) {
            this._removeTpPopover();
            this.$target[0].dataset['titleText'] = widgetValue;
        },
        /**
        * @private
        */
        setStaticImage(previewMode, widgetValue, params) {
            this._removeTpPopover();
            this.OpenMediaDialog();
        },
        /**
        * @private
        */
        setSubtitleText(previewMode, widgetValue, params) {
            this._removeTpPopover();
            this.$target[0].dataset['subtitleText'] = widgetValue;
        },
        /**
        * @private
        */
        setButtonText(previewMode, widgetValue, params) {
            this._removeTpPopover();
            this.$target[0].dataset['buttonText'] = widgetValue;
        },
        /**
        * @private
        */
        setButtonLink(previewMode, widgetValue, params) {
            this._removeTpPopover();
            this.$target[0].dataset['buttonLink'] = widgetValue;
        },
        /**
        * @private
        */
        setTop(previewMode, widgetValue, params) {
            this._removeTpPopover();
            this.$target.get(0).dataset.top = widgetValue;
            this.$target.css({ top: widgetValue + '%' });
        },
        /**
        * @private
        */
        setLeft(previewMode, widgetValue, params) {
            this._removeTpPopover();
            this.$target.get(0).dataset.left = widgetValue;
            this.$target.css({ left: widgetValue + '%' });
        },
        /**
         * @private
         */
        setProduct(previewMode, widgetValue, params) {
            let productId = this.$target.get(0).dataset.productId;
            if (productId) {
                this._openConfigDialog(parseInt(productId));
            } else {
                this._openConfigDialog();
            }
        },
        /**
        * @private
        */
        renderHotspotPreview(previewMode, widgetValue, params) {
            this.PreviewEnabled = !this.PreviewEnabled;
            this.$el.find('[data-name="hotspot_priview"] .fa-eye').toggleClass('text-success', this.PreviewEnabled);
            this._openPopover();
        },
        /**
        * @override
        */
        selectClass: async function (previewMode, widgetValue, params) {
            await this._super(...arguments);
            if (this.$target.find('.dri').length && params.possibleValues.includes('tp_hotspot_style_4')) {
                this.$target.find('.dri').remove();
            }
            if (widgetValue === 'tp_hotspot_style_4' && params.possibleValues.includes('tp_hotspot_style_4')) {
                let $icon = $('<i/>', { 'class': 'dri dri-cart' });
                this.$target.append($icon);
            }
        },

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * @override
         */
        _computeWidgetState(methodName, params) {
            switch (methodName) {
                case 'setTop':
                    return this.$target.get(0).dataset.top || 50;
                case 'setLeft':
                    return this.$target.get(0).dataset.left || 50;
                case 'setButtonLink':
                    return this.$target.get(0).dataset.buttonLink || '/';
                case 'setButtonText':
                    return this.$target.get(0).dataset.buttonText || 'SHOP NOW';
                case 'setSubtitleText':
                    return this.$target.get(0).dataset.subtitleText || "Theme prime is best theme";
                case 'setTitleText':
                    return this.$target.get(0).dataset.titleText || "Your title";
            }
            return this._super(...arguments);
        },
        /**
         * Open a mediaDialog to select/upload image.
         *
         * @private
         * @param {MouseEvent} ev
         */
        OpenMediaDialog: function (ev) {
            this.call("dialog", "add", MediaDialog, {
                onlyImages: true,
                save: image => {
                    this.$target[0].dataset['imageSrc'] = image.src;
                }
            });
        },
        _getHotspotConfig: function () {
            if (this.$target.get(0).dataset.hotspotType === 'static') {
                return { titleText: this.$target.get(0).dataset.titleText, subtitleText: this.$target.get(0).dataset.subtitleText, buttonLink: this.$target.get(0).dataset.buttonLink, hotspotType: this.$target.get(0).dataset.hotspotType, buttonText: this.$target.get(0).dataset.buttonText, imageSrc: this.$target.get(0).dataset.imageSrc };
            }
            return {};
        },
        /**
         * Open popover.
         *
         * @private
         */
        _openPopover: function () {
            if (this.PreviewEnabled) {
                this.$target.popover({
                    animation: true,
                    container: this.$target[0].ownerDocument.body,
                    html: true,
                    trigger: 'manual',
                    content: renderToElement('theme_prime.tp_img_static_template', { widget: this, data: this._getHotspotConfig() }),
                }).on('shown.bs.popover', function () {
                    // $popover must be const otherwise it will crash the browser :|
                    const $popover = $(window.Popover.getInstance(this).tip);
                    $popover.addClass('tp-popover-element');
                }).popover('show');
            } else {
                this._removeTpPopover();
            }
        },
        /**
         * Open a mediaDialog to select/upload image.
         *
         * @private
         * @param {Boolean} force true if not $target in DOM
         */
        _removeTpPopover: function (force) {
            if (force) {
                $('.tp-popover-element').remove();
            } else {
                this.$target.popover('dispose');
            }
            this.PreviewEnabled = false;
            this.$el.find('[data-name="hotspot_priview"] .fa-eye').removeClass('text-success');
        },
        _setConfiguratorParams: function (ev) {
            this.$target[0].dataset['productId'] = ev.TpRecordSelector.recordsIDs[0];
        },
        _openConfigDialog: function (productID) {
            let PRODUCTS_DATA = { recordsLimit: 1, models: ['product.template'], fields: ['name', 'list_price', 'dr_stock_label'], fieldsToMarkUp: ['price', 'list_price', 'dr_stock_label'] }
            let SELECTOR_DATA = { TpRecordSelector: { ...PRODUCTS_DATA, defaultVal: { selectionType: 'manual', model: 'product.template', recordsIDs: productID ? [productID]: []}}};
            this.call("dialog", "add", TpSnippetConfigDialog, {
                components: { ...SELECTOR_DATA },
                save: this._setConfiguratorParams.bind(this),
                onDiscard: () => {},
            });
        },
    });

    options.registry.tp_dynamic_snippet = options.Class.extend({
        /**
         * @constructor
         */
        init() {
            this._super(...arguments);
            this._rpc = options.serviceCached(rpc);
        },
        /**
         * @override
        */
        async willStart() {
            const _super = this._super.bind(this);
            this.registryToUse = this.$target[0].parentElement.classList.contains('o_mega_menu') ? 'theme_prime_mega_menus' : 'theme_prime_snippet_registry';
            if (this.registryToUse === 'theme_prime_snippet_registry') {
                this.switchableRelatedViews = await this._rpc.call("/theme_prime/tp_search_read", { model: 'ir.ui.view', extras: { templateIDs: ['theme_prime.s_tp_categories_menu'] } });
            }
            return _super(...arguments);
        },
        /**
        * @override
        */
        start: function () {
            this.$target.on('click', '.tp-config-link', ev => { ev.preventDefault(); this._openDialog(); });
            return this._super.apply(this, arguments);
        },
        //--------------------------------------------------------------------------
        // Options
        //--------------------------------------------------------------------------

        _getCurrentSnippetId: function () {
            let snippetID = this.$target[0].dataset.tpSnippetId;
            return snippetID === 's_tp_categories_menu' ? 's_mega_menu_category_tabs_snippet' : snippetID;
        },
        /**
         * @override
         */
        onBuilt: function () {
            this._super();
            this._openDialog();
        },
        /**
         * @see this.selectClass for parameters
         */
        setGrid: function (previewMode, value, $opt) {
            this._openDialog();
        },

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        _getValueFromAttr: function ($target, attr) {
            let attrValue = $target.attr(attr);
            return attrValue ? JSON.parse(attrValue) : false;
        },
        /**
         * @private
         */
        _getConfiguratorParams: function () {
            this.usedAttrs = [];
            let snippet = this._getCurrentSnippetId();
            let snippetConfig = registry.category(this.registryToUse).get(snippet);
            let defaultValue = snippetConfig.defaultValue || {};
            let params = { registryToUse: this.registryToUse, videoURL: defaultValue.videoURL, components: {}, snippetID: defaultValue.noSnippet ? false : snippet, $target: this.$target.html() };
            for (let component in snippetConfig.widgets) {
                // In function updateExtraOptsValue we are updating the object
                // But somehow it updating the object reference of the registry itself and all next snippets
                // are having last set dates.
                const value = Object.assign({}, snippetConfig.widgets[component]);
                switch (component) {
                    case 'TpRecordSelector':
                        params['components']['TpRecordSelector'] = Object.assign({}, value, defaultValue, { componentData: this._getValueFromAttr(this.$target, 'data-selection-info') });
                        this.usedAttrs.push('data-selection-info');
                        break;
                    case 'TpUiComponent':
                        params['components']['TpUiComponent'] = { ...value, ...defaultValue, componentData: { ...this._getValueFromAttr(this.$target, 'data-ui-config-info') }, $target: this.$target };
                        this.usedAttrs.push('data-ui-config-info');
                        break;
                    case 'TpExtraOpts':
                        params['components']['TpExtraOpts'] = { ...defaultValue, componentData: this._getValueFromAttr(this.$target, 'data-extra-info') || value, $target: this.$target };
                        this.usedAttrs.push('data-extra-info');
                        break;
                }
            }
            return params;
        },
        /**
         * @private
         */
        _setConfiguratorParams: function (data) {
            let allComponents = data;
            let currentSnippetID = this._getCurrentSnippetId();
            let isSameSnippet = data.templateID === currentSnippetID;
            if (data.$target && !isSameSnippet && data.templateID === 's_mega_menu_category_tabs_snippet' && this.registryToUse === 'theme_prime_snippet_registry') {
                data.$target = this.switchableRelatedViews[0].html;
            }
            if (data.$target && !isSameSnippet) {
                this.options.wysiwyg.odooEditor.observerUnactive();
                Object.values(this.$target[0].attributes).forEach(({ name }) => this.$target[0].removeAttribute(name));
                let vDom = new DOMParser().parseFromString(data.$target, 'text/html').documentElement;
                let block = vDom.querySelector("body section");
                Object.values(block.attributes).forEach(({ name }) => {this.$target[0].setAttribute(name, block.getAttribute(name));});
                this.$target[0].innerHTML = '';
                let child = vDom.querySelector("body section > *");
                this.$target.append(child);
                this.options.wysiwyg.odooEditor.observerActive();
                this.$target.trigger('content_changed');
            }
            for (let component in allComponents) {
                let value = allComponents[component];
                switch (component) {
                    case 'TpRecordSelector':
                        this.$target.attr('data-selection-info', JSON.stringify(value));
                        break;
                    case 'TpUiComponent':
                        value = this._tpModifyValuesBeforeSave(value);
                        this.$target.attr('data-ui-config-info', JSON.stringify(value));
                        break;
                    case 'TpExtraOpts':
                        this.$target.attr('data-extra-info', JSON.stringify(value));
                        break;
                }
            }
            this._refreshPublicWidgets();
        },
        _onDiscardChanges: function() {
            var hasAttr = false;
            if (this.$target.hasClass('tp-mega-menu-snippet')) {
                return;
            }
            this.usedAttrs.forEach((attr) => {
                if (this.$target[0].hasAttribute(attr)) {
                    hasAttr = true;
                }
            });
            // Don't remove mega menu snippet
            if (!hasAttr) {
                // remove snippet on Discard
                this.$target.remove();
            }
        },
        _tpModifyValuesBeforeSave: function (value) {
            if (Object.keys(value).includes('categoryTabsConfig') && value.categoryTabsConfig.activeRecordID && value.categoryTabsConfig.records.length) {
                value.categoryTabsConfig.activeRecordID = value.categoryTabsConfig.records[0].id;
            }
            return value
        },
        /**
         * @private
         */
        _openDialog: function () {
            this.call("dialog", "add", TpSnippetConfigDialog, {
                ...this._getConfiguratorParams(),
                save: this._setConfiguratorParams.bind(this),
                onDiscard: this._onDiscardChanges.bind(this),
            });
        },
        /**
         * @override
         */
        _computeWidgetVisibility: function (widgetName, params) {
            switch (widgetName) {
                case 'show_variant_image': {
                    return this.$target[0].classList.contains('s_d_single_product_cover_snippet_wrapper');
                }
            }
            return this._super(...arguments);
        },
    });
