/** @odoo-module **/

import "@website/js/content/menu";
import publicWidget from "@web/legacy/js/public/public_widget";
import ProductRootWidget from "@theme_prime/js/core/product_root_widget";
import RootWidget from "@theme_prime/js/core/snippet_root_widget";
import { rpc } from "@web/core/network/rpc";
import { SIZES, utils as uiUtils } from "@web/core/ui/ui_service";
import animations from "@website/js/content/snippets.animation";
import { OwlMixin, MarkupRecords, ProductsBlockMixins, CategoryPublicWidgetMixins, ProductCarouselMixins, CartManagerMixin, HotspotMixns, cartMixin, TabsMixin } from "@theme_prime/js/core/mixins";
import { pick } from "@web/core/utils/objects";
import { groupBy } from "@web/core/utils/arrays";
import { renderToElement } from "@web/core/utils/render";
import { localization } from "@web/core/l10n/localization";
import { _t } from "@web/core/l10n/translation";

// Hack ODOO is handling hover by self so manually trigger event remove when new bootstrap is merged in ODOO :)

publicWidget.registry.hoverableDropdown.include({
    _onMouseEnter: function (ev) {
        if (uiUtils.isSmall()) {return}
        // currentTarget dropdown
        $(ev.currentTarget).trigger('show.tp.dropdown');
        this._super.apply(this, arguments);
    },
});

publicWidget.registry.tp_preview_wrapper = publicWidget.Widget.extend({
    selector: '#tp_wrap',
    events: {
        'click': '_onClick',
        'tp-reload': '_onReload',
    },
    start: function () {
        window.dispatchEvent(new CustomEvent('TP_WRAPPER_READY'));
        $('body').addClass('tp-preview-element');
        $('.tp-bottombar-component .tp-bottom-action-btn').addClass('pe-none');
        return this._super.apply(this, arguments);
    },
    _onClick: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
    },
    _onReload: function () {
        this.$domEl = this.$('.tp-droggol-18-builder-snippet');
        this._setOffsetPosition();
        return new Promise((resolve, reject) => {
            this.trigger_up('widgets_start_request', { editableMode: true, $target: this.$domEl, onSuccess: resolve, onFailure: reject });
        });
    },
    _setOffsetPosition: function () {
        this.$domEl.find('> .container').removeClass('container').addClass('container-fluid');
    }
});

// Products Cards
publicWidget.registry.s_d_products_snippet = ProductRootWidget.extend(OwlMixin, ProductsBlockMixins, {
    selector: '.s_d_products_snippet_wrapper',

    bodyTemplate: 'd_s_cards_wrapper',
    bodySelector: '.s_d_products_snippet',
    controllerRoute: '/theme_prime/get_products_data',
    fieldstoFetch: ['name', 'dr_label_id', 'rating', 'public_categ_ids', 'product_variant_ids', 'dr_stock_label', 'colors'],
    snippetNodeAttrs: (ProductRootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info']),

    /**
     * initialize owlCarousel.
     * @private
     */
    _modifyElementsAfterAppend: function () {
        this._super.apply(this, arguments);
        if (this.uiConfigInfo.mode === 'slider') {
            this.initializeOwlSlider(this.uiConfigInfo.ppr);
        }
    },
});

publicWidget.registry.s_product_listing_cards_wrapper = ProductRootWidget.extend(ProductsBlockMixins, MarkupRecords, {
    selector: '.s_product_listing_cards_wrapper, .s_image_product_listing_cards_wrapper',
    bodyTemplate: 'd_s_cards_listing_wrapper',
    bodySelector: '.s_product_listing_cards',
    controllerRoute: '/theme_prime/get_listing_products',
    fieldstoFetch: ['name', 'rating'],
    snippetNodeAttrs: (ProductRootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info', 'data-ui-config-info']),

    _getOptions: function () {
        let value = pick(this.uiConfigInfo || {}, 'bestseller', 'newArrived', 'discount');
        value['mode'] = this.selectionInfo.selectionType || 'manual';
        value['shop_config_params'] = true;
        return value;
    },
    _processData: function (data) {
        this.numOfCol = 12 / Object.keys(data.products).length;
        let result = [];
        let {products} = data;
        for (let key in products) {
            const list = products[key];
            switch (key) {
                case 'bestseller':
                    result.push({ title: _t("Best Seller"), products: list });
                    break;
                case 'newArrived':
                    result.push({ title: _t("Newly Arrived"), products: list });
                    break;
                case 'discount':
                    result.push({ title: _t("On Sale"), products: list });
                    break;
            }
            this._markUpValues(this.tpFieldsToMarkUp, list);
        }
        return result;
    },
    _getLimit: function () {
        return this.uiConfigInfo.limit || 5;
    }
});

// Countdown snippet
publicWidget.registry.s_d_single_product_count_down = ProductRootWidget.extend(ProductsBlockMixins, {
    selector: '.s_d_single_product_count_down_wrapper',

    bodyTemplate: 's_d_single_product_count_down_temp',
    bodySelector: '.s_d_single_product_count_down',

    controllerRoute: '/theme_prime/get_products_data',

    snippetNodeAttrs: (ProductRootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info']),

    fieldstoFetch: ['name', 'offer_data', 'description_ecommerce'],

    extraLibs: (ProductRootWidget.prototype.extraLibs || []).concat(['/theme_prime/static/lib/OwlCarousel2-2.3.4/owl.carousel.js']),
    /**
     * initialize owlCarousel.
     * @private
     */
    _modifyElementsAfterAppend: function () {
        this._super.apply(this, arguments);
        this._reloadWidget({ selector: '.tp-countdown'});
        this.$('.droggol_product_slider_single_product').owlCarousel({ dots: false, margin: 20, rtl: localization.direction === 'rtl', stagePadding: 5, rewind: true, nav: true, navText: ['<i class="dri dri-arrow-left-l"></i>', '<i class="dri dri-arrow-right-l"></i>'], responsive: {0: {items: 1,},}});
    },
});

publicWidget.registry.s_product_listing_tabs_snippet = ProductRootWidget.extend(OwlMixin, MarkupRecords, TabsMixin, {
    selector: '.s_product_listing_tabs_wrapper',
    controllerRoute: '/theme_prime/get_tab_listing_products',
    bodySelector: '.s_product_listing_tabs',
    supportedTypes: ['bestseller', 'discount', 'newArrived'],
    snippetNodeAttrs: (ProductRootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info']),
    read_events: Object.assign({ 'click .d_category_lable': '_onCategoryTabClick' }, ProductRootWidget.prototype.read_events),

    _getDomainValues: function (recordID) {
        let { limit } = this.uiConfigInfo;
        let params = { limit: limit, fields: this.fieldstoFetch };
        let selectedTab = this.categories.find(c => c.id === recordID);
        let productListingType = selectedTab ? selectedTab.type : 'bestseller';
        if (productListingType === 'discount') {
            params['domain'] = [['dr_has_discount', '!=', false]];
        } else {
            params['order'] = this._getSortbyValue(productListingType);
        }
        if (this.domainRecordID) {
            params['options'] = { categoryID: this.domainRecordID };
        }
        return params;
    },
    _getSortbyValue: function (productListingType) {
        if (productListingType === 'bestseller') {
            return productListingType;
        }
        if (productListingType === "newArrived") {
            return 'create_date desc';
        }
        return false;
    },
    _getOptions: function () {
        if (this.selectionInfo && this.selectionInfo.recordsIDs && this.selectionInfo.recordsIDs.length) {
            this.domainRecordID = this.selectionInfo.recordsIDs[0];
            return { categoryID: this.domainRecordID, shop_config_params: true};
        }
        return {shop_config_params: true};
    },
    _setCamelizeAttrs: function () {
        this._super.apply(this, arguments);
        this.initialType = false;
        this.categories = [];
        let labels = {bestseller:  _t("Best Sellers"), discount: _t("On Sale"), newArrived:  _t("Newly Arrived")};
        this.supportedTypes.forEach((type, index) => {
            this.initialType = !this.initialType && this.uiConfigInfo[type] ? type : this.initialType;
            if (this.uiConfigInfo[type]) {
                this.categories.push({id: index+1, name: labels[type], type:type});
            }
        });
    },
    /**
     * initialize owlCarousel.
     * @override
     */
    _modifyElementsAfterAppend: function () {
        this._super.apply(this, arguments);
        if (this.uiConfigInfo.mode === 'slider') {
            this.initializeOwlSlider(this.uiConfigInfo.ppr);
        }
    },
    _getSortBy: function () {
        return this._getSortbyValue(this.initialType);
    },
    _getLimit: function () {
        return this.uiConfigInfo.limit || 5;
    },
    _getDomain: function () {
        return this.initialType === 'discount' ? [['dr_has_discount', '!=', false]] : false;
    },
    _processData: function (data) {
        this._markUpValues(this.tpFieldsToMarkUp, data.products);
        if (data.listing_category && data.listing_category.length) {
            this.listing_category = data.listing_category[0];
        }
        this._super.apply(this, arguments);
        return data.products;
    },
});

publicWidget.registry.s_category_snippet = ProductRootWidget.extend(OwlMixin, MarkupRecords, CategoryPublicWidgetMixins, TabsMixin, {
    selector: '.s_d_category_snippet_wrapper, .s_products_by_brands_tabs_wrapper',
    bodySelector: '.s_d_category_snippet',
    snippetNodeAttrs: (ProductRootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info']),
    controllerRoute: '/theme_prime/get_products_by_category',
    read_events: Object.assign({'click .d_category_lable': '_onCategoryTabClick'}, ProductRootWidget.prototype.read_events),

    start: function () {
        this.isBrand = this.$target.hasClass('s_products_by_brands_tabs_wrapper');

        // 🚫 Disable scroll reload for category snippet on mobile
        if (uiUtils.isSmall()) {
            this.options.disableScrollReload = true;
    }

        if (this.isBrand) {
            this.bodySelector = '.s_products_by_brands_tabs';
        }
        return this._super.apply(this, arguments);
    },
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _getDomainValues: function (categoryID) {
        let { includesChild, sortBy, limit } = this.uiConfigInfo;
        var operator = '=';
        if (includesChild) {
            operator = 'child_of';
        }
        let domain = [['public_categ_ids', operator, categoryID]]
        if (this.isBrand) {
            domain = [['attribute_line_ids.value_ids', 'in', [categoryID]]];
        }
        return { domain: domain, options:{order: sortBy,limit: limit} ,fields: this.fieldstoFetch};
    },
    /**
     * initialize owlCarousel.
     * @override
     */
    _modifyElementsAfterAppend: function () {
        this._super.apply(this, arguments);
        var categories = this.fetchedCategories;
        // if first categories is archive or moved to another website then activate first category
        if (categories.length && categories[0] !== this.initialCategory) {
            this._fetchAndAppendByCategory(categories[0]);
        }
        if (this.uiConfigInfo.mode === 'slider') {
            this.initializeOwlSlider(this.uiConfigInfo.ppr);
        }
    },
    /**
     * @override
     */
    _processData: function (data) {
        var categories = this.fetchedCategories;
        if (!categories.length) {
            this._appendNoDataTemplate();
            return [];
        }

        // if initialCategory is archive or moved to another website
        if (categories.length && categories[0] !== this.initialCategory) {
            return [];
        } else {
            this._markUpValues(this.tpFieldsToMarkUp, data.products);
            return data.products;
        }
    },
    /**
     * @override
     */
    _setDBData: function (data) {
        let recordsIDs = this.selectionInfo.recordsIDs || [];
        let categories = recordsIDs.map((categoryID) => {return data.categories.find(c => c.id === categoryID);});
        this.categories = categories.filter((x) => !!x);
        this.fetchedCategories = this.categories.map((category) => { return category.id; });
        this.selectionInfo.recordsIDs = this.fetchedCategories;
        this._super.apply(this, arguments);
    },
});

publicWidget.registry.s_single_category_snippet = ProductRootWidget.extend(CategoryPublicWidgetMixins, MarkupRecords, {
    selector: '.s_d_single_category_snippet_wrapper',
    bodyTemplate: 's_single_category_snippet',
    bodySelector: '.s_d_single_category_snippet',
    snippetNodeAttrs: (ProductRootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info']),
    controllerRoute: '/theme_prime/get_products_by_category',
    fieldstoFetch: ['name', 'rating', 'public_categ_ids'],
    extraLibs: (ProductRootWidget.prototype.extraLibs || []).concat(['/theme_prime/static/lib/OwlCarousel2-2.3.4/owl.carousel.js']),
    /**
     * @private
     */
    _setDBData: function (data) {
        var categories = data.categories;
        if (categories && categories.length) {
            this.categoryName = categories.length ? categories[0].name : false;
        }
        this._super.apply(this, arguments);
    },
    /**
     * initialize owlCarousel.
     * @private
     */
    _modifyElementsAfterAppend: function () {
        this._super.apply(this, arguments);
        this.initializeOwlSlider(this.uiConfigInfo.ppr);
    },
    /**
     * @private
     */
    _processData: function (data) {
        if (this.categoryName) {
            // group of 8 products
            var items = 8;
            if (uiUtils.isSmall() || uiUtils.getSize() === 3) {
                items = 4;
            }
            this._markUpValues(this.tpFieldsToMarkUp, data.products);
            var group = groupBy(data.products, function (product) {
                let index = data.products.findIndex(x => x.id === product.id);
                return Math.floor(index / (items));
            });
            return Object.keys(group).map((key) => group[key]);
        } else {
            return [];
        }
    },
    initializeOwlSlider: function () {
        this.$('.droggol_product_category_slider').owlCarousel({ dots: false, margin: 10, stagePadding: 1, rtl: localization.direction === 'rtl', rewind: true, nav: true, navText: ['<div class="badge text-primary"><i class="dri font-weight-bold dri-chevron-left-l"></i></div>', '<div class="badge text-primary"><i class="dri dri-chevron-right-l font-weight-bold"></i></div>'], responsive: {0: {items: 1}, 576: {items: 1}, 768: {items: 1}, 992: {items: 1}, 1200: {items: 1}}});
    }
});
publicWidget.registry.s_category_brands = RootWidget.extend(ProductsBlockMixins, {
    selector: '.s_category_small, .s_brands_small',
    snippetNodeAttrs: (RootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info']),
    controllerRoute: '/theme_prime/get_brands_category_data',
    bodyTemplate: 's_category_brands',
    fieldstoFetch: ['name'],
    /**
    * @private
    */
    _getImgUrl: function(id) {
        return this._getResModel() === 'product.attribute.value' ? `/web/image/${this._getResModel()}/${id}/dr_image` : `/web/image/${this._getResModel()}/${id}/image_128`;
    },
    /**
    * @private
    */
    _getItemUrl: function (record) {
        return this._getResModel() === 'product.attribute.value' ? `/shop?attribute_value=${record.attribute_id[0]}-${record.id}` : `/shop/category/${record.id}`;
    },
    /**
    * @private
    */
    _getBodyDetails: function(resModel) {
        let resModels = {'product.attribute.value': {title: _t('Shop By Brands'), url: '/shop/all-brands'}, 'product.public.category': {title: _t('Shop By Categories'), url: '/shop'}};
        return resModels[resModel];
    },
    _getResModel: function() {
        return this.$target.get(0).dataset.tpResModel;
    },
    /**
    * @private
    */
    _getOptions: function () {
        return this.selectionInfo ? { model: this._getResModel() } : this._super.apply(this, arguments);
    },
});

// Full product snippet
publicWidget.registry.s_single_product_snippet = RootWidget.extend(ProductCarouselMixins, {
    selector: '.s_d_single_product_snippet_wrapper',

    snippetNodeAttrs: (RootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info', 'data-extra-info']),
    bodyTemplate: 's_single_product_snippet',
    controllerRoute: '/theme_prime/get_quick_view_html',
    bodySelector: '.d_single_product_continer',
    noDataTemplateString: _t("No product found"),
    noDataTemplateSubString: _t("Sorry, this product is not available right now"),
    displayAllProductsBtn: false,

    _setCamelizeAttrs: function () {
        this._super.apply(this, arguments);
        if (this.selectionInfo) {
            var productIDs = this.selectionInfo.recordsIDs;
            // first category
            if (productIDs.length) {
                this.initialProduct = productIDs[0];
            }
        }
    },
    /**
    * @private
    */
    _getOptions: function () {
        var options = {};
        if (this.initialProduct) {
            options['product_tmpl_id'] = this.initialProduct;
            return options;
        } else {
            return this._super.apply(this, arguments);
        }
    },
    _modifyElementsAfterAppend: function () {
        this._super.apply(this, arguments);
        this._reloadWidget({ selector: '.oe_website_sale' });
        this._bindEvents(this._getBodySelectorElement());
    },
});

// Full product snippet + cover
publicWidget.registry.s_d_single_product_cover_snippet = publicWidget.registry.s_single_product_snippet.extend({
    selector: '.s_d_single_product_cover_snippet_wrapper',

    bodyTemplate: 's_d_single_product_cover_snippet',
    bodySelector: '.s_d_single_product_cover_snippet',

    /**
    * @private
    */
    _getOptions: function () {
        var options = {};
        if (this.initialProduct) {
            options['product_tmpl_id'] = this.initialProduct;
            options['right_panel'] = true;
            return options;
        } else {
            return this._super.apply(this, arguments);
        }
    },
});

publicWidget.registry.s_d_top_categories = RootWidget.extend(MarkupRecords, {
    selector: '.s_d_top_categories',
    bodyTemplate: 's_top_categories_snippet',
    bodySelector: '.s_d_top_categories_container',
    controllerRoute: '/theme_prime/get_top_categories',

    snippetNodeAttrs: (RootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info', 'data-ui-config-info', 'data-extra-info']),

    noDataTemplateString: _t("No categories found!"),

    noDataTemplateSubString: false,
    displayAllProductsBtn: false,

    /**
    * @private
    */
    _getOptions: function () {
        var options = {};
        if (this.selectionInfo) {
            options['params'] = {
                categoryIDs: this.selectionInfo.recordsIDs,
                sortBy: this.uiConfigInfo.sortBy,
                limit: this.uiConfigInfo.limit,
                includesChild: this.uiConfigInfo.includesChild,
            };
            return options;
        } else {
            return this._super.apply(this, arguments);
        }
    },
    _setDBData: function (data) {
        this._super.apply(this, arguments);
        data = data || [];
        var FetchedCategories = data.map((category) => {
            return category.id;
        });
        var categoryIDs = [];
        let recordsIDs = this.selectionInfo.recordsIDs || [];
        recordsIDs.forEach((categoryID) => {
            if (FetchedCategories.includes(categoryID)) {
                categoryIDs.push(categoryID);
            }
        });
        this.selectionInfo.recordsIDs = categoryIDs;
    },
    /**
    * @private
    */
    _processData: function (data) {
        let recordsIDs = this.selectionInfo.recordsIDs || [];
        this._markUpValues(['min_price'], data);
        let res = recordsIDs.map((categoryID) => { return data.find(c => c.id === categoryID); });
        return res;
    },
});

publicWidget.registry.s_d_product_count_down = ProductRootWidget.extend(ProductsBlockMixins, {
    selector: '.s_d_product_count_down',

    bodyTemplate: 's_d_product_count_down_template',
    bodySelector: '.s_d_product_count_down_body',

    snippetNodeAttrs: (ProductRootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info']),

    controllerRoute: '/theme_prime/get_products_data',

    fieldstoFetch: ['name', 'description_ecommerce', 'rating', 'public_categ_ids', 'offer_data'],

    extraLibs: (ProductRootWidget.prototype.extraLibs || []).concat(['/theme_prime/static/lib/OwlCarousel2-2.3.4/owl.carousel.js']),
    /**
     * @private
     */
    _getOptions: function () {
        var options = this._super.apply(this, arguments);
        if (this.selectionType) {
            options = options || {};
            options['shop_config_params'] = true;
        }
        return options;
    },
    /**
     * @private
     */
    _setDBData: function (data) {
        this.shopParams = data.shop_config_params;
        this._super.apply(this, arguments);
    },
    /**
     * initialize owlCarousel.
     * @private
     */
    _modifyElementsAfterAppend: function () {
        this._super.apply(this, arguments);
        this._reloadWidget({ selector: '.tp-countdown' });
        this.$('.droggol_product_slider_top').owlCarousel({
            dots: false,
            margin: 20,
            stagePadding: 5,
            rewind: true,
            rtl: localization.direction === 'rtl',
            nav: true,
            navText: ['<i class="dri h4 dri-chevron-left-l"></i>', '<i class="dri h4 dri-chevron-right-l"></i>'],
            responsive: {0: {items: 1}, 768: {items: 2}, 992: {items: 1}, 1200: {items: 1},
            },
        });
    },
});

publicWidget.registry.s_two_column_card_wrapper = ProductRootWidget.extend(OwlMixin, ProductsBlockMixins, {
    selector: '.s_two_column_card_wrapper',
    bodyTemplate: 'd_s_cards_wrapper',
    bodySelector: '.s_two_column_cards',
    snippetNodeAttrs: (ProductRootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info', 'data-ui-config-info']),
    controllerRoute: '/theme_prime/get_products_data',
    fieldstoFetch: ['name', 'dr_label_id', 'rating', 'public_categ_ids', 'product_variant_ids', 'description_ecommerce', 'colors', 'dr_stock_label'],

    _setCamelizeAttrs: function () {
        this._super.apply(this, arguments);
        if (this.uiConfigInfo) {
            this.uiConfigInfo['ppr'] = 2;
        }
        this.selectionType = false;
        if (this.selectionInfo) {
            this.selectionType = this.selectionInfo.selectionType;
        }
    },
    /**
     * initialize owlCarousel.
     * @private
     */
    _modifyElementsAfterAppend: function () {
        this._super.apply(this, arguments);
        this._reloadWidget({ selector: '.tp-product-preview-swatches'});
        if (this.uiConfigInfo.mode === 'slider') {
            this.initializeOwlSlider(this.uiConfigInfo.ppr, true);
        }
    },
});
publicWidget.registry.s_d_product_small_block = ProductRootWidget.extend(ProductsBlockMixins, {
    selector: '.s_d_product_small_block',

    bodyTemplate: 's_d_product_small_block_template',
    bodySelector: '.s_d_product_small_block_body',

    snippetNodeAttrs: (ProductRootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info']),

    controllerRoute: '/theme_prime/get_products_data',

    fieldstoFetch: ['name', 'rating', 'public_categ_ids', 'dr_label_id'],

    extraLibs: (ProductRootWidget.prototype.extraLibs || []).concat(['/theme_prime/static/lib/OwlCarousel2-2.3.4/owl.carousel.js']),
    /**
     * initialize owlCarousel.
     * @private
     */
    _modifyElementsAfterAppend: function () {
        var self = this;
        this._super.apply(this, arguments);
        this.inConfirmDialog = this.$el.hasClass('in_confirm_dialog');
        if (this.inConfirmDialog) {
            this.$('.owl-carousel').removeClass('container');
        }
        this.$('.droggol_product_slider_top').owlCarousel({ dots: false, margin: 20, stagePadding: this.inConfirmDialog ? 0 : 5, rewind: true, nav: true, rtl: localization.direction === 'rtl', navText: ['<i class="dri h4 dri-chevron-left-l"></i>', '<i class="dri h4 dri-chevron-right-l"></i>'],
            onInitialized: function () {
                var $img = self.$('.d-product-img:first');
                if (self.$('.d-product-img:first').length) {
                    $img.one("load", function () {
                        setTimeout(function () {
                            if (!uiUtils.isSmall()) {
                                var height = self.$target.parents('.s_d_2_column_snippet').find('.s_d_product_count_down .owl-item.active .tp-side-card').height();
                                self.$('.owl-item').height(height+1);
                            }
                        }, 300);
                    });
                }
            },
            responsive: {0: {items: 2}, 576: {items: 2}, 768: {items: 2}, 992: {items: 2}, 1200: {items: 3}
            },
        });
    },
});

publicWidget.registry.s_d_image_products_block = ProductRootWidget.extend(ProductsBlockMixins, MarkupRecords, {
    selector: '.s_d_image_products_block_wrapper',
    bodyTemplate: 's_d_image_products_block_tmpl',
    snippetNodeAttrs: (ProductRootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info']),
    bodySelector: '.s_d_image_products_block',
    controllerRoute: '/theme_prime/get_products_data',
    fieldstoFetch: ['name', 'rating', 'public_categ_ids'],
    extraLibs: (ProductRootWidget.prototype.extraLibs || []).concat(['/theme_prime/static/lib/OwlCarousel2-2.3.4/owl.carousel.js']),
    _getOptions: function () {
        let opts = this._super.apply(this, arguments);
        return { ...opts, 'shop_config_params': true};
    },
    _processData: function (data) {
        var products = this._getProducts(data);
        this._markUpValues(this.tpFieldsToMarkUp, products);
        var items = 8;
        if (uiUtils.isSmall()) {
            items = 4;
        }
        var group = groupBy(products, function (product) {
            let index = products.findIndex(x => x.id === product.id);
            return Math.floor(index / (items));
        });
        return Object.keys(group).map((key) => group[key]);
    },
    _modifyElementsAfterAppend: function () {
        this._super.apply(this, arguments);
        this.$('.droggol_product_slider_top').owlCarousel({ dots: false, margin: 10, stagePadding: 5, rewind: true, nav: true, rtl: localization.direction === 'rtl', navText: ['<i class="dri h4 dri-chevron-left-l"></i>', '<i class="dri h4 dri-chevron-right-l"></i>'], responsive: {0: {items: 1}, 576: {items: 1}, 768: {items: 1}, 992: {items: 1}, 1200: {items: 1}},
        });
    },
});

publicWidget.registry.s_d_products_grid_wrapper = ProductRootWidget.extend(ProductsBlockMixins, {
    selector: '.s_d_products_grid_wrapper',
    bodyTemplate: 's_d_products_grid_tmpl',
    snippetNodeAttrs: (ProductRootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info']),
    bodySelector: '.s_d_products_grids',
    controllerRoute: '/theme_prime/get_products_data',
    fieldstoFetch: ['name', 'rating', 'public_categ_ids', 'offer_data'],
    _getOptions: function () {
        if (!this.selectionInfo) {
            return false;
        }
        return this._super.apply(this, arguments);
    },
    /**
     * initialize owlCarousel.
     * @private
     */
    _modifyElementsAfterAppend: function () {
        this._super.apply(this, arguments);
        this._reloadWidget({ selector: '.tp-countdown' });
    }
});
// Mega menus not crystal clear code :(
publicWidget.registry.s_category_tabs_snippet = RootWidget.extend({
    selector: '.s_category_tabs_snippet_wrapper:not(.tp-side-menu), .s_tp_categories_menu',
    bodySelector: '.s_category_tabs_snippet',
    bodyTemplate: 's_category_tabs_snippet_wrapper',
    controllerRoute: '/theme_prime/get_megamenu_categories',
    snippetNodeAttrs: (RootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info', 'data-ui-config-info', 'data-extra-info']),
    read_events: Object.assign({
        'mouseover .tp-menu-category-tab': '_onActivateMenuItem',
        'mouseleave .tp-side-menu': '_onMouseLeave',
        'click .tp-menu-category-tab': '_onActivateMenuItem',
    }, RootWidget.prototype.events),

    isMobileDevice: uiUtils.getSize() <= SIZES.MD,
    /**
 * @override
 */
    start: function () {
        let defs = [this._super.apply(this, arguments)];
        this.isSideMenu = false;
        if (this.$target.hasClass('s_tp_categories_menu')) {
            this.$target.find('.s_category_tabs_snippet_wrapper').addClass('tp-side-menu');
            this.isSideMenu = true;
        }
        return Promise.all(defs);
    },
    _onMouseLeave: function(ev) {
        if (this.isSideMenu) {
            this.$target.find('.tp-submenu-float').addClass('d-none');
            let activeTab = this.$target.get(0).querySelector('.tp-active-category');
            if (activeTab) {
                activeTab.classList.remove('tp-active-category');
            }
        }
    },
    /**
     * @override
     */
    destroy: function () {
        if (this.selectionInfo && this.uiConfigInfo) {
            this._super.apply(this, arguments);
        }
    },
    /**
     * @override
     */
    _getLimit: function () {
        return this.selectionInfo && this.selectionInfo.recordsIDs ? 21 : false;
    },
    /**
     * @override
     */
    _getOptions: function () {
        let options = this.uiConfigInfo && this.uiConfigInfo.onlyDirectChild ? { onlyDirectChild: this.uiConfigInfo.onlyDirectChild } : { };
        return this.selectionInfo && this.selectionInfo.recordsIDs ? { ...options , categoryIDs: this.selectionInfo.recordsIDs } : false;
    },
    /**
     * @override
     */
    _getSortBy: function () {
        return this.uiConfigInfo && this.uiConfigInfo.childOrder ? this.uiConfigInfo.childOrder : 'count';
    },
    /**
     * @private
     */
    _isActionEnabled: function (actionName, actions) {
        let allActions = actions || this.uiConfigInfo.activeActions;
        return allActions.includes(actionName);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param categoryID {Integer} ID of category ID
     * Display submenu
     */
    _activateCategory: function (categoryID) {
        if (!this.editableMode) {
            this.$target.find('.tp-submenu-float').removeClass('d-none');
        }
        let $submenu = $(this.$(".tp-category-submenu[data-submenu-id='" + categoryID + "']"));
        this.$('.tp-category-submenu').addClass('d-none');
        $submenu.removeClass('d-none');
        if (!$submenu.hasClass('tp-fetched-submenu')) {
            this._activateCategorySubmenu($submenu);
        } else {
            this._setOffsetPosition(this.$(".tp-menu-category-tab[tp-menu-id='" + categoryID + "']"));
        }
        this.$('.tp-menu-category-tab').removeClass('tp-active-category');
        this.$(".tp-menu-category-tab[tp-menu-id='" + categoryID + "']").addClass('tp-active-category');
    },
    _isLabelActive: function () {
        return this.uiConfigInfo && this.uiConfigInfo.menuLabel;
    },
    /**
     * @private
     * @param {jQuery} $target
     */
    _activateCategorySubmenu: function ($target) {
        this._reloadWidget({ target: $target.find('> .tp-mega-menu-snippet') });
        $target.addClass('tp-fetched-submenu');
    },
    /**
     * @private
     * @param categoryID {Integer}
     * @return {Object}
     */
    getCategoryConfigData: function (categoryID) {
        if (this.uiConfigInfo && this.uiConfigInfo.categoryTabsConfig && this.uiConfigInfo.categoryTabsConfig.records) {
            let records = this.uiConfigInfo.categoryTabsConfig.records || [];
            let record = records.find((res) => res.id === categoryID);
            if (record) {
                record['activeActions'] = [];
                // force create activeActions array coz boolean is not acceptable
                ['brand', 'label', 'count'].forEach(actionName => {
                    if (record[actionName]) {
                        record.activeActions.push(actionName);
                    }
                });
                return record;
            }
        }
        return {};
    },
    /**
     * Set value for primary attrs
     * @private
     * @param data {Object}
     * @return {String}
     */
    _getSelectionData: function (data) {
        return JSON.stringify({ selectionType: "manual", recordsIDs: data.map((child) => { return child.id }) });
    },
    /**
     * Set value for secondary attrs
     * @private
     * @param categoryID {Integer}
     * @return {Object}
     */
    _getUIConfigData: function (categoryID) {
        let { style, limit, activeActions, background, productListing } = this.getCategoryConfigData(categoryID);
        return { productListing: productListing || 'bestseller', background: background || false, style: style || 's_tp_hierarchical_category_style_1', limit: limit, activeActions: activeActions || [], model: "product.public.category" };
    },
    /**
     * @override
     */
    _modifyElementsAfterAppend: function () {
        this._super.apply(this, arguments);
        this._activateCategorySubmenu(this.$('.tp-category-submenu:not(.d-none)'));
        if (this.editableMode && this.uiConfigInfo.categoryTabsConfig && this.uiConfigInfo.categoryTabsConfig.activeRecordID) {
            this._activateCategory(this.uiConfigInfo.categoryTabsConfig.activeRecordID);
        }
        if (this.isSideMenu) {
            let target = this.$target.get(0).querySelector('.s_category_tabs_snippet_wrapper');
            let width = target.offsetWidth * 3.29;
            if (target.querySelector('.tp-submenu-float')) {
                target.querySelector('.tp-submenu-float').style.maxWidth = `${width}px`;
                target.querySelector('.tp-submenu-float').style.width = `${width}px`;
            }
        }
    },
    /**
     * @override
     */
    _processData: function (data) {
        let result = [];
        let recordsIDs = this.selectionInfo.recordsIDs || [];
        recordsIDs.forEach((recordsID) => {
            let categoryRec = data.find(category => { return category.category.id === recordsID; });
            if (categoryRec && categoryRec.category) {
                let res = this.getCategoryConfigData(categoryRec.category.id);
                let child = res.child;
                categoryRec['child'] = categoryRec.child.slice(0, child);
                result.push(categoryRec);
            }
        });
        return result;
    },
    /**
     * Set offset to tab
     * @private
     * @param $target {Jquery element}
     */
    _setOffsetPosition: function ($target) {
        if (this.isMobileDevice) {
            $('#top_menu_collapse').animate({
                scrollTop: $target.offset().top < 0 ? $target.offset().top : 0
            }, 0);
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param ev {Object} event
     */
    _onActivateMenuItem: function (ev) {
        if (this.isMobileDevice && ev.type === 'mouseover') {
            return;
        }
        let menuID = parseInt($(ev.currentTarget).attr('tp-menu-id'));
        ev.stopPropagation();
        if (!ev.currentTarget.classList.contains('tp-active-category')) {
            this._activateCategory(menuID);
        }
    },
});
publicWidget.registry.s_tp_mega_menu_category_snippet = RootWidget.extend({
    selector: '.s_tp_mega_menu_category_snippet',
    bodySelector: '.s_tp_mega_menu_category_snippet_wrapper',
    bodyTemplate: 's_tp_hierarchical_category_wrapper',
    controllerRoute: '/theme_prime/get_megamenu_categories',
    snippetNodeAttrs: (RootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info', 'data-ui-config-info', 'data-extra-info']),
    /**
     * @private
     */
    _isActionEnabled: function (actionName, actions) {
        let allActions = actions || this.uiConfigInfo.activeActions;
        return allActions.includes(actionName);
    },
    _getOptions: function () {
        if (this.selectionInfo && this.selectionInfo.recordsIDs) {
            return { categoryIDs: this.selectionInfo.recordsIDs};
        }
        return false;
    },
    /**
     * @override
    */
    _getSortBy: function () {
        return this.uiConfigInfo && this.uiConfigInfo.childOrder ? this.uiConfigInfo.childOrder : 'count';
    },
    destroy: function () {
        if (this.selectionInfo && this.uiConfigInfo) {
            this._super.apply(this, arguments);
        }
    },
    _getLimit: function () {
        return this.uiConfigInfo.hasOwnProperty('limit') ? this.uiConfigInfo.limit : false;
    },
    _modifyElementsAfterAppend: function () {
        this._reloadWidget({ selector: '.tp-droggol-18-builder-snippet' });
        this._reloadWidget({ selector: '.s_d_brand_snippet_wrapper' });
    },
    _getProductSelectionData: function () {
        return this.JaysonStringify({ selectionType: "advance", domain_params: { domain: [["public_categ_ids", "child_of", this.selectionInfo.recordsIDs]], limit: 5, order: "bestseller"} });
    },
    _getUIConfigData: function () {
        let config = {};
        config[this.uiConfigInfo.productListing] = true;
        return this.JaysonStringify(Object.assign({}, config, { 'limit': 3, 'style': 'tp_product_list_cards_4', 'header': 'tp_product_list_header_1', 'activeActions': ['rating', 'add_to_cart', 'wishlist', 'quick_view'], 'model': 'product.template' }));
    },
    _processData: function (data) {
        let result = this.uiConfigInfo ? [] : false;
        this.recordsIDs = [];
        let recordsIDs = this.selectionInfo.recordsIDs || [];
        recordsIDs.forEach((recordsID) => {
            let categoryRec = data.find(category => { return category.category.id === recordsID; });
            if (categoryRec) {
                result.push(categoryRec);
                this.recordsIDs.push(recordsID);
            }
        });
        return result;
    },
});
publicWidget.registry.s_category_ui_snippet = ProductRootWidget.extend(ProductsBlockMixins, {
    selector: '.s_category_snippet_wrapper',
    bodySelector: '.s_category_snippet',
    snippetNodeAttrs: (ProductRootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info']),
    bodyTemplate: 's_tp_category_wrapper_template',
    controllerRoute: '/theme_prime/get_categories_info',
    fieldstoFetch: ['dr_category_label_id'],
    _setCamelizeAttrs: function () {
        this._super.apply(this, arguments);
        if (this.selectionInfo) {
            this.categoriesTofetch = [];
            this.categoriesTofetch = this.selectionInfo.recordsIDs;
            this.categoryStyle = this.uiConfigInfo.style;
        }
    },
    _getOptions: function () {
        return {categoryIDs: this.categoriesTofetch, getCount: true};
    },
    _processData: function (data) {
        let categories = this.categoriesTofetch.map(categoryID => {
            return data.find(c => c.id === categoryID);
        });
        return categories.filter((x) => !!x);
    },
});

publicWidget.registry.s_d_brand_snippet = RootWidget.extend({
    selector: '.s_d_brand_snippet_wrapper.tp-droggol-18-builder-snippet',

    controllerRoute: '/theme_prime/get_brands',
    bodyTemplate: 's_d_brand_snippet',
    bodySelector: '.s_d_brand_snippet',
    fieldstoFetch: ['id', 'name', 'attribute_id'],
    displayAllProductsBtn: false,
    snippetNodeAttrs: (RootWidget.prototype.snippetNodeAttrs || []).concat(['data-selection-info', 'data-ui-config-info', 'data-extra-info']),
    noDataTemplateString: _t("No brands are found!"),
    noDataTemplateSubString: _t("Sorry, We couldn't find any brands right now"),
    extraLibs: (RootWidget.prototype.extraLibs || []).concat(['/theme_prime/static/lib/OwlCarousel2-2.3.4/owl.carousel.js']),

    /**
     * @private
     */
    _getOptions: function () {
        // Hack
        this.recordsIDs = this.selectionInfo && this.selectionInfo.recordsIDs || [];
        this.categories = this.$target.get(0).dataset.categories;
        this.mode = this.uiConfigInfo && this.uiConfigInfo.mode || 'slider';
        this.cardStyle = this.uiConfigInfo && this.uiConfigInfo.style || 'tp_brand_card_style_1';
        return {
            limit: this.brandCount,
            recordsIDs: this.recordsIDs,
            categories: this.categories ? JSON.parse(this.categories) : false,
        };
    },
    _processData: function(data) {
        if (!this.recordsIDs.length) {
            return data;
        }
        let matchedRecords = [];
        this.selectionInfo.recordsIDs.forEach((resID) => {
            let record = data.find((rec) => rec.id === resID);
            if (record) {
                matchedRecords.push(record);
            }
        });
        return matchedRecords;
    },
    _modifyElementsAfterAppend: function () {
        this._super.apply(this, arguments);
        if (this.mode === 'slider') {
            this.$('.s_d_brand_snippet > .row').addClass('owl-carousel');
            this.$('.s_d_brand_snippet > .row > *').removeAttr('class').addClass(this.cardStyle);
            // remove col-* classes
            this.$('.s_d_brand_snippet > .row > *').removeAttr('class');
            this.$('.s_d_brand_snippet > .row').removeClass('row');
            this.$('.owl-carousel').owlCarousel({ nav: false, dots: false, autoplay: true, autoplayTimeout: 4000, rtl: localization.direction === 'rtl', responsive: {0: {items: 2}, 576: {items: 4}}});
        }
    },
});

publicWidget.registry.tp_image_hotspot = publicWidget.Widget.extend(HotspotMixns, cartMixin, CartManagerMixin, MarkupRecords, {
    // V15 refector whole widget such a way that we can pass params directly in Qweb
    // <t t-if="productInfo"> is bad code

    selector: '.tp_hotspot',
    disabledInEditableMode: false,
    tpFieldsToMarkUp: ['price', 'rating', 'list_price', 'label_template', 'dr_stock_label', 'colors'],

    init: function () {
        this._super.apply(this, arguments);
        this.notification = this.bindService("notification");
    },

    /**
     * @override
     */
    start: function () {
        let defs = [this._super.apply(this, arguments)];
        this.hotspotType = this.$target.get(0).dataset.hotspotType;
        this.onHotspotClick = this.$target.get(0).dataset.onHotspotClick;
        let def = this._renderHotspotTemplate();
        if (!this._isPublicUser()) {
            defs.push(def);
        }
        if (this.editableMode && this.hotspotType === 'dynamic' && this.onHotspotClick === 'modal') {
            this.$target.removeAttr('tabindex');
            this.$target.removeAttr('data-bs-toggle');
            this.$target.removeAttr('data-bs-trigger');
        } else {
            this.$target.attr({ tabindex: '0', 'data-bs-toggle': 'popover', 'data-bs-trigger': 'focus' });
        }
        return Promise.all(defs);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * This is responsible to fetch product related data.
     *
     * @returns {Promise}
     */
    _fetchData: async function () {
        return await rpc('/theme_prime/get_products_data', {
            'domain': [['id', 'in', [parseInt(this.$target.get(0).dataset.productId)]]],
            'fields': ['description_ecommerce', 'rating'],
            'limit': 1
        });
    },
    /**
     * initialize popover
     */
    _initPopover: function () {
        let self = this;
        this.$target.popover({ animation: true, container: 'body', html: true, placement: 'auto', content: renderToElement('theme_prime.tp_img_static_template', {widget: this, data: this._getHotspotConfig()})}).on('shown.bs.popover', function () {
            let $popover = $(window.Popover.getInstance(this).tip);
            $popover.off().on('click', '.tp-add-to-cart-action', ev => {
                self.onAddToCartClick(ev);
            });
            $popover.addClass('tp-popover-element border-0 shadow-sm');
        });
    },
    /**
     * That's good code. isn't it? :)
     */
    _isLoaded: function () {
        return new Promise((resolve, reject) => {
            var $relatedImage = $(this.$target.closest('.tp-img-hotspot-wrapper').find(".tp-img-hotspot-enable"));
            // ImagesLazyLoading Odoo hack
            if ($relatedImage.get(0).naturalWidth) {
                resolve();
            }
            $relatedImage.one("load", function () { resolve(); });
        });
    },
    _renderHotspotTemplate: async function () {
        if (this._isPublicUser()) {
            await this._isLoaded();
        }
        let defs = [];
        if (this.onHotspotClick === 'popover') {
            if (this.hotspotType === 'dynamic') {
                defs.push(this._fetchData());
                let [data] = await Promise.all(defs);
                this._markUpValues(this.tpFieldsToMarkUp, data.products);
                this.productInfo = data.products.length ? data.products[0] : false;
                if (this.productInfo && this.productInfo.has_discounted_price) {
                    this.productInfo['discount'] = Math.round((this.productInfo.list_price_raw - this.productInfo.price_raw) / this.productInfo.list_price_raw * 100);
                }
                this._initPopover();
            }
        }
        if (this.hotspotType === 'static') {
            await Promise.all(defs);
            this._initPopover()
        }

        if (!this.editableMode) {
            this._cleanNodeAttr();
        }
    },
});

publicWidget.registry.TpHotspotScroll = animations.Animation.extend({
    selector: '.tp_hotspot',
    effects: [{
        startEvents: 'scroll',
        update: '_onScroll',
    }],
    _onScroll: function (scroll) {
        if ($('.tp-popover-element:visible').length) {
            this.$target.blur();
        }
    },
});
