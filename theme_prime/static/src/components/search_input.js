/** @odoo-module **/

import { useService } from '@web/core/utils/hooks';
import { MediaDialog } from '@web_editor/components/media_dialog/media_dialog';
import { debounce } from '@web/core/utils/timing';
import { uniqueId } from "@web/core/utils/functions";
import { registry } from '@web/core/registry';
import { AbstractComponent, CoreComponent } from './abstract_component';
import { _t } from "@web/core/l10n/translation";

import { Component, onWillStart, onWillUpdateProps, toRaw, useState, useRef, onMounted } from "@odoo/owl";
import { deserializeDateTime } from "@web/core/l10n/dates";
const { DateTime } = luxon;

export class TpDropDown extends Component {
    setup() {
        let { buttonClasses} = this.props;
        this.buttonClasses = buttonClasses || 'btn-primary';
        super.setup();
    }
    get name() { return this.props.name; }
    get title() { return this.props.title; }
    _getRecordByID(recordID) {
        return this.props.records.find((record) => record.id === recordID);
    }
    _onClickItem(recordID) {
        this.env.changeValue(recordID, this.name);
    }
    getResModelData(resModel) {
        let data = {
            'product.template': { title: _t('Products'), color: 'primary' },
            'product.product': { title: _t('Products'), color: 'primary' },
            'product.attribute.value': { title: _t('Brands'), color: 'danger' },
            'product.public.category': { title: _t('Categories'), color: 'success' },
        }
        return data[resModel];
    }
    get buttonPlaceholder() { return this.props.buttonPlaceholder || 'theme_prime.tp_dropdown_placeholder'; }
    get dropDownPlaceholder() { return this.props.dropDownPlaceholder || 'theme_prime.tp_dropdown_placeholder'; }
    get menuClass() { return this.props.menuClass || ''; }
    get menuItemClass() { return this.props.menuItemClass || ''; }
}
TpDropDown.template = 'theme_prime.TpDropDown';

export class TpSearchInput extends CoreComponent {
    setup() {
        this.search = debounce((ev) => this._onSearch(ev), 400);
        this.onFocusout = debounce((ev) => this._onFocusout(ev), 200);
        // useRef is not a good idea. We will find another way someday :)
        this.searchInput = useRef('tp-search-input');
        this.searchComponent = useRef('tp-search-component');
        this.searchDropdown = useRef('tp-search-dropdown');

        this.componentService = useService('shared_component_service');
        this.state = useState({records: [], term: '', collections: []});
        super.setup();
    }
    get model() {
        return this.defaultParams.model;
    }
    get defaultParams() {
        return this.props.defaultParams;
    }
    get fieldsToMarkup() {
        return this.props.fieldsToMarkup;
    }
    get brand() {
        return this.props.brand;
    }
    get hasSuggestion() {
        return this.props.hasSuggestion;
    }
    _getCollectionDomain(term) {
        return [['name', 'ilike', term], ['dr_res_model', '=', this.defaultParams.model]];
    }
    async _onSearch (event) {
        let term = event.target.value;
        let extras = {'brands' : this.defaultParams.model === "product.attribute.value" && this.brand ? this.brand : false};
        if (term) {
            let params = { ...this.defaultParams, domain: this._getSearchDomain(term), extras: extras, limit:5 };
            this.state.records = await this.componentService._fetchRecords(params, { fieldsToMarkup: this.fieldsToMarkup });
            this.state.collections = await this.componentService._fetchRecords({ model: 'dr.snippet.records.collection', domain: this._getCollectionDomain(term), extras: {dr_res_model: this.defaultParams.model}});
        } else {
            this._clearAutoComplete();
        }
        this.state.term = term;
    }
    async showSuggestion () {
        this._clearAutoComplete();
        let extras = { ids: this.getExcludedRecordsIDs, 'brands': this.defaultParams.model === "product.attribute.value" && this.brand ? this.brand : false, show_suggestion: true };
        let params = { ...this.defaultParams, domain: this._getSearchDomain(), extras: extras, limit: 5 };
        this.state.records = await this.componentService._fetchRecords(params, { fieldsToMarkup: this.fieldsToMarkup });
    }
    _onFocusout () {
        if (this.searchComponent.el && !this.searchComponent.el.contains(document.activeElement)) {
            this._clearAutoComplete();
        }
    }
    _onClickSelectRecord (recordID) {
        this.env.performAction('ADD', recordID);
        this._clearAutoComplete();
        this.searchInput.el.focus();
    }
    async _onClickRemoveCollection (recordID) {
        await this.componentService._fetchRecords({ model: 'dr.snippet.records.collection', domain: [['id', '=', recordID], ['dr_res_model', '=', this.defaultParams.model]], extras: { unlink: true } });
        this._clearAutoComplete();
    }
    _onClickSelectCollection(recordID) {
        let record = this.getRecord(this.state.collections, recordID)
        this.env.performAction('ADD_ALL', toRaw(record.recordIDs));
        this._clearAutoComplete();
    }
    _getSearchDomain (term) {
        if (term) {
            if (['product.template', 'product.product'].includes(this.model)) {
                return [['id', 'not in', this.getExcludedRecordsIDs], '|', ['name', 'ilike', term], ['default_code', 'ilike', term]];
            }
            return [['id', 'not in', this.getExcludedRecordsIDs], ['name', 'ilike', term]];
        }
        return [['id', 'not in', this.getExcludedRecordsIDs]];
    }
    _clearAutoComplete () {
        this.searchInput.el.value = '';
        this.state.term = '';
        this.state.records = [];
        this.state.collections = [];
    }
    get getExcludedRecordsIDs () {
        return this.props.recordsIDs || [];
    }
    get resModelInfo() {
        return {
        'product.template': { title: _t("Products"), template: 'theme_prime.tpProductPlaceHolder'},
        'product.product': { title: _t("Variants"), template: 'theme_prime.tpProductPlaceHolder'},
        'product.public.category': { title: _t("Categories"), template: 'theme_prime.tpProductPlaceHolder'},
        'product.attribute.value': { title: this.props.brand ? _t("Brands")  : _t("Attributes")},
        'dr.product.label': { title: _t("Labels")},
        'product.tag': { title: _t("Tags")}};
    }
}
TpSearchInput.template = 'theme_prime.TpSearchInput';


export class TpRangeInput extends Component {
    setup() {
        this.input = useRef('tp-range-input');
    }
    onChangeInput(ev) {
        this.env.changeValue(parseInt(ev.currentTarget.value), this.props.name);
    }
    onInput(ev) {
        let percentage = (parseInt(ev.currentTarget.value) - this.minValue) / (this.maxValue - this.minValue) * 100;
        this.input.el.style.backgroundImage = `linear-gradient(90deg, #0080ff ${percentage}%, transparent ${percentage}%)`;
    }
    get maxValue() { return this.props.maxValue || 6; }
    get minValue() { return 'minValue' in this.props ? this.props.minValue : 4; }
    get title() { return this.props.title; }
    get value() { return 'value' in this.props ? parseInt(this.props.value) : 4;}
    get style() {
        let percentage = (this.value - this.minValue) / (this.maxValue - this.minValue) * 100;
        return `linear-gradient(90deg, #0080ff ${percentage}%, transparent ${percentage}%)`
    }
}
TpRangeInput.template = 'theme_prime.TpRangeInput';

export class TpBoolean extends Component {
    setup() {
        this.uid = uniqueId('tp-boolean-component-');
    }
    onChangeInput(ev) {
        this.env.changeValue(ev.currentTarget.checked, this.props.name);
    }
    get title() { return this.props.title; }
    get switch() { return this.props.switch || false; }
    get value() {
        return Object.keys(this.props).includes('value') ? this.props.value : false;
    }
}
TpBoolean.template = 'theme_prime.TpBoolean';

export class TpImageUpload extends Component {
    setup() {
        this.dialogs = useService('dialog');
    }
    onClick(ev) {
        this.dialogs.add(MediaDialog, {
            onlyImages: true,
            resModel: 'ir.ui.view',
            useMediaLibrary: true,
            save: image => {
                this.env.changeValue(image.src, this.props.name);
            },
        });
    }
    onClickRemove() {
        this.env.changeValue(false, this.props.name);
    }
    get title() { return this.props.title; }
    get value() {
        return Object.keys(this.props).includes('value') ? this.props.value : false;
    }
}
TpImageUpload.template = 'theme_prime.TpImageUpload';

export class TpCardGrid extends AbstractComponent {
    setup() {
        let { value } = this.props;
        this._coreCProps = {
            changeValue: this._onChangeComponentValue.bind(this),
        };
        this.state = useState({
            value: toRaw(value.activeRecordID),
            records: toRaw(this.recordsIDs),
            activeConfig: this.activeConfig
        });
        super.setup();
        onWillUpdateProps(this._insertFromProps);
        onWillStart(async () => {
            await this.updateData()
        });
    }
    get value() { return this.props.value.activeRecordID; }
    get activeConfig() { return this.getRecordFromData(this.props.value.records, this.props.value.activeRecordID) }
    get supportedComponents() {
        return ['style', 'productListing', 'child', 'limit', 'brand', 'label', 'count', 'background', 'onlyDirectChild'];
    }
    get componentRegistry() {
        return {TpDropDown: ['style', 'productListing'], TpRangeInput: ['child', 'limit'], TpBoolean: ['brand', 'label', 'count'], TpImageUpload: ['background']};
    }
    get componentDefaultVal() {
        return this.state.activeConfig;
    }
    get nodeOptions() {
        let buttonClasses = { buttonClasses: "btn d-flex justify-content-between align-items-center btn-light bg-white border shadow-sm fw-light w-100" };
        return {style: { ...buttonClasses, title: _t("Style"), records: this.styles.map((style, index) => { return { id: style, title: _t(`Style - ${index + 1}`) }; })}, productListing: { ...buttonClasses, title: _t("Product Listing"), records: [{ id: 'bestseller', title: _t("Best Seller"), iconTemplate: 'dri dri-bolt' }, { iconTemplate: 'fa fa-percent', id: 'discount', title: _t("Discount") }]}, limit: { title: _t("No. of items"), maxValue: 20, minValue: 0 }, child: { title: _t("No. of Child"), maxValue: 20, minValue: 3 }, brand: { title: _t("Brands")}, label: { title: _t("Label")}, count: { title: _t("Count")}, background: { title: _t("Bg. Image")}};
    }
    async updateData(IDs) {
        let recordsIDs = IDs || this.recordsIDs;
        let fetchedCategoryData = await this.componentService._fetchRecords({ options: { getCount: true, categoryIDs: recordsIDs }, fields: ['dr_category_label_id'] }, { routePath: '/theme_prime/get_categories_info' });
        let records = [];
        recordsIDs.forEach((resID) => {
            let matchedRecord = this.getRecordFromData(fetchedCategoryData, resID);
            if (matchedRecord) {
                records.push({ title: matchedRecord.name, id: resID, imgSrc: `/web/image/product.public.category/${resID}/image_128`, subtitle: `${matchedRecord.count} Products` })
            }
        });
        this.state.value = records.length ? this.props.value.activeRecordID : false;
        this.state.records = records;
        this.state.activeConfig = this.getRecordFromData(this.props.value.records, this.state.value);
    }
    getRecordFromData(records, recordID) {
        return records.find((record) => record.id === recordID);
    }
    async _insertFromProps(nextProps) {
        this.updateData(nextProps.value.records.map(rec => rec.id));
    }
    get getCardComponent() {
        return TpCardComponent;
    }
    get recordsIDs() {
        return this.props.value.records.map(rec => rec.id);
    }
    getValues(recordID) {
        return this.props.value.records.find((record) => record.id === recordID);
    }
    get styles() {
        return Object.keys(registry.category('theme_prime_mega_menu_cards').content);
    }
    _onChangeComponentValue(value, name) {
        if (name === 'categories') {
            this.state.activeConfig = this.getRecordFromData(this.props.value.records, value);
            this.state.value = value;
            this.env.changeValue({ activeRecordID: value, records: toRaw(this.props.value.records) }, 'categoryTabsConfig');
        } else {
            let rec = this.getValues(this.state.value);
            rec[name] = value;
            this.env.changeValue({ activeRecordID: this.state.value, records: toRaw(this.props.value.records) }, 'categoryTabsConfig');
        }
    }
}
TpCardGrid.template = 'theme_prime.TpCardGrid';
TpCardGrid.components = { TpDropDown };

export class TpComponentGroup extends AbstractComponent {
    setup() {
        this.supportedComponents = Object.keys(this.value);
        this._coreCProps ={
            changeValue: this._onChangeComponentValue.bind(this),
        };
        super.setup();
    }
    get value() { return this.props.value; }
    get mobileStyles() {
        let headerRegistry = registry.category('theme_prime_mobile_card_registry');
        return Object.keys(headerRegistry.content);
    }
    get componentRegistry() {
        return {
            TpDropDown: ['style', 'mode'],
        }
    }
    get nodeOptions () {
        let buttonClasses = { buttonClasses: "btn d-flex justify-content-between align-items-center btn-light bg-white border shadow-sm fw-light w-100" };
        return {
            style: { ...buttonClasses, title: _t("Mobile Style"), records: [{ id: 'default', title: _t('Same as Desktop') }, ...this.mobileStyles.map((style, index) => { return { id: style, title: _t(`Style - ${index + 1}`) }; })]}, mode: { ...buttonClasses, title: _t("Mode"), records: [{ id: 'default', title: _t('Same as Desktop') }, { id: 'grid', iconTemplate: 'fa fa-th-large pe-2', title: _t('Grid') }, { iconTemplate: 'fa pe-2 fa-arrows-h', id: 'slider', title: _t('Slider') }] },
        };
    }
    get componentDefaultVal() {
        return this.value;
    }
    _onChangeComponentValue(value, name) {
        this.value[name] = value;
        this.env.changeValue(toRaw(this.value), this.props.name);
    }
}
TpComponentGroup.template = 'theme_prime.TpComponentGroup';

export class TpActions extends Component {
    setup() {
        this.orm = useService("orm");
        if(!this.isReadOnly) {
            this.website = useService('website');
            onWillStart(async () => {
                this.shopConfig = await this.orm.call("website", "get_theme_prime_shop_config", [], {context: {website_id: this.website.currentWebsite.id}});
            });
        }
    }
    get supportedActions() {
        return [...this.props.supportedActions];
    }
    get isReadOnly() {
        let { isReadOnly } = this.props.extras;
        return isReadOnly;
    }
    get activeActions() {
        return [...this.props.activeActions] || [];
    }
    _getAction(action) {
        let allActions = { colors: { icon: 'theme_prime.icon_brush', label: _t('Colors') }, count: { icon: 'theme_prime.icon_hash_tag', label: _t("Count") }, brand: { icon: 'theme_prime.icon_tag', label: _t("Brands") }, quick_view: { icon: 'theme_prime.icon_eye', label: _t('QUICK VIEW') }, add_to_cart: { icon: 'theme_prime.icon_cart', label: _t('ADD TO CART') }, category_info: { icon: 'theme_prime.icon_font', label: _t('CATEGORY') }, wishlist: { icon: 'theme_prime.icon_heart', label: _t('WISHLIST') }, comparison: { icon: 'theme_prime.icon_exchange', label: _t('COMPARE') }, rating: { icon: 'theme_prime.icon_star', label: _t('RATING') }, description_ecommerce: { icon: 'theme_prime.icon_description', label: _t('DESCRIPTION') }, label: { icon: 'theme_prime.icon_tag', label: _t('LABEL') }, show_similar: { icon: 'theme_prime.icon_box', label: _t('SIMILAR') } };
        let selectedAction = Object.keys(allActions).includes(action) ? allActions[action] : false;
        if (!this.isReadOnly && ['rating', 'wishlist', 'comparison'].includes(action) && !this.shopConfig[`is_${action}_active`]) {
            selectedAction['disabled'] = true;
            selectedAction['title'] = `${action} is disabled from the shop if you want to use it please enable it from the shop`;
        }
        return selectedAction;
    }
    onActionClick(action) {
        let actions = this.activeActions;
        if (actions.includes(action)) {
            actions.splice(actions.indexOf(action), 1);
        } else {
            actions.push(action)
        }
        this.env.changeValue(actions, 'activeActions');
    }
}
TpActions.template = 'theme_prime.TpActions';

export class TpDatePicker extends AbstractComponent {
    setup() {
        this.title = this.props.title;
        this.dateInput = useRef('tp-date-input');
        this.dateTimePicker = useService('datetime_picker');
        this.pickerType = this.props.pickerType || 'datetime';
        this.state = useState({
            value: this.props.value,
            countdown: {days:'00', hours:'00', minutes:'00', seconds:'00'}
        })
        onMounted(() => {
            this.picker = this.dateTimePicker.create({
                target: this.dateInput.el,
                onApply: this._onDateTimePickerChange.bind(this),
                pickerProps: {type: this.pickerType, minDate: DateTime.fromObject({ year: 1000 }), maxDate: DateTime.now().plus({ year: 200 }), value: DateTime.fromSeconds(parseInt(this.state.value)), rounding: 0,}
            });
            this.picker.enable();
            if (this.state.value) {
                this._updateCounters();
            }
        });
        super.setup();
    }
    get name() { return this.props.name; }
    onClickTime() {
        this.dateInput.el.click();
    }
    _updateCounters() {
        const dueDate = toRaw(this.state.value);
        let eventTime = luxon.DateTime.now();
        if (dueDate.includes("-")) {
            eventTime = deserializeDateTime(dueDate);
        } else {
            eventTime = luxon.DateTime.fromISO(new Date(parseInt(dueDate) * 1000).toISOString());
        }
        if (Math.floor(eventTime.diffNow().as("seconds")) > 0) {
            if (this.countDownTimer) {
                this._endCountdown();
            }
            this.countDownTimer = setInterval(() => {
                const diff = eventTime.diffNow();
                if (Math.floor(diff.as("seconds")) <= 0) {
                    this._endCountdown();
                }
                const format = diff.toFormat("dd:hh:mm:ss").split(":");
                this.state.countdown.days = format[0];
                this.state.countdown.hours = format[1];
                this.state.countdown.minutes = format[2];
                this.state.countdown.seconds = format[3];
            }, 1000);
        } else {
            this._endCountdown();
        }
    }
    _onDateTimePickerChange(luxonData) {
        if (!luxonData || !luxonData.isValid) {
            this.state.value = "";
        } else {
            this.state.value = luxonData.toUnixInteger().toString();
        }
        if (this.countDownTimer) {
            this._endCountdown();
        }
        if (this.state.value !== "") {
            this._updateCounters();
        }
        this.env.changeValue(toRaw(this.state.value), this.name);
    }
    _endCountdown() {
        clearInterval(this.countDownTimer);
    }
}
TpDatePicker.template = 'theme_prime.TpDatePicker';
export class TpDomainComponent extends AbstractComponent {
    setup() {
        this.value = { ...this.props };
        this.supportedComponents = ['limit', 'order'];
        this.state = useState({
            domainProps: this.prepareDomainValues(this.value.domain),
            condition: this.value.domain.length && this.value.domain[0] === '|' ? 'or' : 'and'
        });
        this._coreProps = {
            changeValue: this._onChangeComponentValue.bind(this),
        };
        this._coreCProps = {
            updateSelectionComponentValue: this.updateSelectionComponentValue.bind(this),
            recordsReady: this.onRecordsReady.bind(this)
        };
        // History risky fix
        // onWillUpdateProps(nextProps => {
        //     // avoid first call for useEffect
        //     if (nextProps && nextProps.domain) {
        //         this.state['domainProps'] = this.prepareDomainValues(nextProps.domain);
        //         this.state['condition'] = nextProps.domain.length && nextProps.domain[0] === '|' ? 'or' : 'and';
        //     }
        // });
        super.setup();
    }
    prepareDomainValues(domain) {
        domain = this._normalizeDomain(toRaw(domain))
        let values = [];
        domain.forEach((collection) => {
            values.push({
                domain: collection,
                editMode: false,
                records: [],
            });
        });
        return values;
    }
    onRecordsReady(records, key) {
        if (this.state.domainProps[key].records.length !== records.length) {
            this.state.domainProps[key].records = toRaw(records);
        }
    }
    async updateSelectionComponentValue(key, value, name) {
        if (key === 'recordsIDs') {
            this.state.domainProps[name].domain[2] = value;
        }
    }
    _onChangeCondition(ev) {
        this.state.condition = ev.currentTarget.value;
        this._onChangeComponentValue(toRaw(this.domainToCondition), 'domain');
    }
    _onChangeComponentValue(value, name) {
        if (name === 'domainTemplate') {
            let { domain, sortBy } = this.getRecord(this.domainTemplates, value);
            this.state.domainProps = this.prepareDomainValues(this._normalizeDomain(domain))
            if (sortBy) {
                this._onChangeComponentValue(sortBy, 'order')
            }
        } else {
            this.value[name] = value;
            this.env.performAction('ADVANCE', this.value)
        }
    }
    _normalizeDomain(domain) {
        return domain.filter((node) => { return Array.isArray(node)})
    }
    onAddNewRule() {
        let { domainProps } = this.state;
        domainProps.push({domain: ['name', 'ilike', ''], editMode: true, records: []});
        this.state['domainProps'] = domainProps;
    }
    onChangeValue(ev, index, fieldType) {
        let value = fieldType === 'integer' ? parseInt(ev.target.value) : ev.target.value;
        this.state.domainProps[index].domain[2] = value;
    }
    onEditRule(index, mode) {
        this.state.domainProps.forEach((val, i) => {
            if (index === i) {
                val.editMode = mode;
            }
        });
        if (!mode) {
            this._onChangeComponentValue(toRaw(this.domainToCondition), 'domain');
        }
    }
    onDeleteRule(index) {
        this.state.domainProps.splice(index, 1);
        this._onChangeComponentValue(toRaw(this.domainToCondition), 'domain');
    }
    get fieldsList () {
        return [{ 'type': 'text', 'name': 'name', 'label': _t('Name') }, { 'type': 'many2many', 'name': 'public_categ_ids', 'label': _t('Category'), 'relationModel': 'product.public.category' }, { 'type': 'many2one', 'name': 'dr_brand_value_id', 'label': _t('Brand'), 'relationModel': 'product.attribute.value', 'extras': { 'brands': true } }, { 'type': 'many2one', 'name': this.value.environmentModel === 'product.template' ? 'attribute_line_ids.value_ids' : 'product_template_attribute_value_ids.product_attribute_value_id', 'label': _t('Attributes'), 'relationModel': 'product.attribute.value' }, {'type': 'many2one', 'name': 'dr_label_id', 'label': _t('Label'), 'relationModel': 'dr.product.label' }, {'type': 'integer', 'name': 'list_price', 'label': _t('Price') }, {'type': 'many2one', 'name': 'product_tag_ids', 'label': _t('Tags'), 'relationModel': 'product.tag', 'is_multi_website': true }, {'type': 'boolean', 'name': 'dr_has_discount', 'label': _t('Discount') }];
    }
    get domainTemplates() {
        return [{ id: 0, subtitle: _t("Select any template and modify as per your need.") , title: _t("Choose Template"), domain: [], sortBy: 'create_date desc' },{ id: 1, subtitle: _t("Show newly arrived products based on creation date") , title: _t("New Arrival"), domain: [], sortBy: 'create_date desc' },{ id: 2, subtitle: _t("Show newly arrived products from selected categories"),title: _t("Category New Arrival"), domain: [["public_categ_ids", "in", []]], sortBy: 'create_date desc' },{ id: 3, subtitle: _t("Show newly arrived products from selected brands"), title: _t("Brand New Arrival"), domain: [["dr_brand_value_id", "in", []]], sortBy: 'create_date desc' },{ id: 4, subtitle: _t("Show newly arrived products from selected tags"), title: _t("Tags New Arrival"), domain: [["product_tag_ids", "in", []]], sortBy: 'create_date desc' },{ id: 5, subtitle: _t("Show newly arrived products from selected label."), title: _t("Label New Arrival"), domain: [["dr_label_id", "in", []]], sortBy: 'create_date desc' },{ id: 6, subtitle: _t("Show discounted products based on product pricelist"), title: _t("Discounted Products"), domain: [['dr_has_discount', '!=', false]], sortBy: 'list_price asc' },{ id: 7, subtitle: _t("Show discounted products based on product pricelist from selected categories"), title: _t("Category Discounted Products"), domain: ['&', ['dr_has_discount', '!=', false], ["public_categ_ids", "in", []]], sortBy: 'list_price asc' },{ id: 8, subtitle: _t("Show discounted products based on product pricelist from selected brands."), title: _t("Brand Discounted Products"), domain: ['&', ['dr_has_discount', '!=', false], ["dr_brand_value_id", "in", []]], sortBy: 'list_price asc' },{ id: 9, subtitle: _t("Show discounted products based on product pricelist from selected tags"), title: _t("Tags Discounted Products"), domain: ['&', ['dr_has_discount', '!=', false], ["product_tag_ids", "in", []]], sortBy: 'list_price asc' },{ id: 10, subtitle: _t("Show discounted products based on product pricelist from selected label"), title: _t("Label Discounted Products"), domain: ['&', ['dr_has_discount', '!=', false], ["dr_label_id", "in", []]], sortBy: 'list_price asc' },{ id: 11, subtitle: _t("Show best seller products based on last 30 days sales"), title: _t("Best Seller"), domain: [], sortBy: 'bestseller' },{ id: 12, subtitle: _t("Show best seller products based on last 30 days sales from selected categories."), title: _t("Category Best Seller"), domain: [["public_categ_ids", "in", []]], sortBy: 'bestseller' },{ id: 13, subtitle: _t("Show best seller products based on last 30 days sales from selected brands."), title: _t("Brand Best Seller"), domain: [["dr_brand_value_id", "in", []]], sortBy: 'bestseller' },{ id: 14, subtitle: _t("Show best seller products based on last 30 days sales from selected tags."), title: _t("Tags Best Seller"), domain: [["product_tag_ids", "in", []]], sortBy: 'bestseller' },{ id: 15, subtitle: _t("Show best seller products based on last 30 days sales from selected label."), title: _t("Label Best Seller"), domain: [["dr_label_id", "in", []]], sortBy: 'bestseller' },{ id: 16, subtitle: _t("Show best seller products with discount"), title: _t("Discounted Best Seller"), domain: [['dr_has_discount', '!=', false]], sortBy: 'bestseller' },{ id: 17, subtitle: _t("Show best seller products with discount from the selected categories"), title: _t("Category Discounted Best Seller"), domain: ['&', ["public_categ_ids", "in", []], ['dr_has_discount', '!=', false]], sortBy: 'bestseller' },{ id: 18, subtitle: _t("Show best seller products with discount from the selected brands"), title: _t("Brand Discounted Best Seller"), domain: ['&', ["dr_brand_value_id", "in", []], ['dr_has_discount', '!=', false]], sortBy: 'bestseller' },{ id: 19, subtitle: _t("Show best seller products with discount from the selected tags"), title: _t("Tags Discounted Best Seller"), domain: ['&', ["product_tag_ids", "in", []], ['dr_has_discount', '!=', false]], sortBy: 'bestseller' },{ id: 20, subtitle: _t("Show best seller products with discount from the selected label"), title: _t("Label Discounted Best Seller"), domain: ['&', ["dr_label_id", "in", []], ['dr_has_discount', '!=', false]], sortBy: 'bestseller' }];
    }
    _prepareRecords(index) {
        let { domain } = this.state.domainProps[index];
        let field = domain[0];
        return {
            componentData: { selectionType: 'manual', recordsIDs: domain[2], model: this.getRecord(this.fieldsList, field, 'name').relationModel},
            name: index,
            extras: { isReadOnly: this.props.isReadOnly, fields: ['name'], mode: 'badge', isBrand: this.getRecord(this.fieldsList, field, 'name').relationModel === 'product.attribute.value' && field === 'dr_brand_value_id' ? true : false }
        }
    }
    getRelatedOperator(field) {
        let fieldsInfo = this.fieldsList.find((record) => record.name === field);
        return this.operatorInfo[fieldsInfo.type].value;
    }
    onChangeField (ev, index) {
        let fieldName = ev.target.value;
        let fieldType = this.getRecord(this.fieldsList, fieldName, 'name').type;
        let op = Object.keys(this.getRelatedOperator(fieldName))[0];
        this.state.domainProps[index] ={domain: [fieldName, op, this.operatorInfo[fieldType].defaultVal], editMode: true, records: []};
    }
    onChangeOperator (ev, index) {
        let {domain, records} = this.state.domainProps[index];
        this.state.domainProps[index] = { domain: [domain[0], ev.target.value, domain[2]], editMode: true, records: records};
    }
    get domainToCondition() {
        let sign = this.state.condition === 'and' ? '&' : '|';
        let { domainProps } = this.state;
        let domain = Array.from({ length: domainProps.length - 1 }, (x, i) => sign);
        domainProps.forEach((item) => {
            domain.push(item.domain);
        });
        return domain;
    }
    get operatorInfo () {
        return {'text': {value: { 'ilike': "contains", 'not ilike': "doesn't contain", '=': "is equal to", '!=': "is not equal to" }, defaultVal: ''},'many2many': {value: { 'in': "is having", 'not in': "is not having", 'child_of': "is having child" }, defaultVal: []},'many2one':{value: { 'in': "is having", 'not in': "is not having" }, defaultVal: []},'integer': {value: { '=': "equals to", '!=': "not equals to", '>': 'greater than', '<': 'less then' }, defaultVal: 100},'boolean': {value: { '!=': 'having', '=': 'not having' }, defaultVal: false }};
    }
    get componentRegistry() {
        return {TpDropDown: ['order'], TpRangeInput: ['limit']}
    }
    get nodeOptions() {
        return { limit: { title: _t("No. of items"), maxValue: 20, minValue: 4 }, order: { buttonClasses: "btn d-flex btn-sm justify-content-between align-items-center btn-light bg-white border shadow-sm fw-light w-100", title: _t("Order By"), records: [{ id: 'list_price asc', title: _t("Price: Low to High") }, { id: 'list_price desc', title: _t("Price: High to Low") }, { id: 'name asc', title: _t("Name: A to Z") }, { id: 'name desc', title: _t("Name: Z to A") }, { id: 'create_date desc', title: _t("Newly Arrived") }, { id: 'bestseller', title: _t("Bestseller") }, { id: 'last_viewed', title: _t("Recently Viewed") }]}};
    }
    get componentDefaultVal() {
        return this.props;
    }
}
TpDomainComponent.template = 'theme_prime.TpDomainComponent';
TpDomainComponent.components = { TpDropDown };

// we will add support for ControlPanel :)
registry.category('theme_components').add("TpDatePicker", TpDatePicker).add("TpRangeInput", TpRangeInput).add("TpBoolean", TpBoolean).add("TpCardGrid", TpCardGrid).add("TpDropDown", TpDropDown).add("TpActions", TpActions).add('TpImageUpload', TpImageUpload).add('TpComponentGroup', TpComponentGroup).add('TpDomainComponent', TpDomainComponent).add('TpSearchInput', TpSearchInput);