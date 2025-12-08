/** @odoo-module **/

import { useService } from '@web/core/utils/hooks';
import { loadJS } from "@web/core/assets";
import { registry } from '@web/core/registry';
import { AbstractComponent } from './abstract_component';
import { _t } from "@web/core/l10n/translation";

import { onWillStart, useRef, onMounted, useState, toRaw, useEffect, onWillUpdateProps } from "@odoo/owl";

export class TpRecordSelector extends AbstractComponent {
    setup() {
        if (!this.isReadOnly) {
            this.actionService = useService("action");
        }
        this.supportedComponents = ['TpSearchInput', 'selectionType', 'model'];
        this.state = useState({
            last_update: Date.now(),
            collectionState: 'draft',
        });
        this._rpcFlag = false;
        useEffect((el) => {
            // update when resModel/template is changed
            if (this._rpcFlag) {
                this._refreshRecords(this.recordsIDs)
            }
        }, () => [this.props.extras.templateID, this.props.extras.activePricelist]);
        this.componentService = useService('shared_component_service');
        if (this.SelectionMode !== 'badge') {
            this.recordsContainer = useRef('tp-records-container');
        }
        this.collectionInput = useRef('tp-collection-input');
        this._coreProps = {
            performAction: this.performAction.bind(this),
            changeValue: this._onChangeComponentValue.bind(this),
        };
        onWillStart(async () => {
            // sh*tty lib someday we will develope our own library :)
            // We are using it right now bcoz it's light weight but we can do better then this.
            await loadJS("/theme_prime/static/lib/Sortable/Sortable.js");
            let params = { ...this.defaultParams, domain: this._getRecordsDomain()};
            this.records = await this.componentService._fetchRecords(params, { fieldsToMarkup: this.fieldsToMarkup });
            if (this.SelectionMode === 'badge') {
                this.env.recordsReady(this.records, this.props.name);
            }
            if (this.environmentModel === 'product.public.category') {
                this.fetchedCategoryData = await this.componentService._fetchRecords({ options: { getCount: true, categoryIDs: this.recordsIDs }, fields: ['dr_category_label_id']}, { routePath: '/theme_prime/get_categories_info'});
            }
            // magic happens here :)
            if (this.props.selectionType === 'manual' && recordsIDs.length !== this.records) {
                let recordsIDs = toRaw(this.recordsIDs);
                let matchedRecIDs = [];
                recordsIDs.forEach((resID) => {
                    if (this.getRecord(this.records, resID)) {
                        matchedRecIDs.push(resID);
                    }
                });
                this.performAction('REPLACE', matchedRecIDs);
            }
        });

        onMounted(() => {
            if (this.recordsContainer) {
                this.sortables = new Sortable(this.recordsContainer.el, { animation: 150, handle: '.tp-sortable-handle', ghostClass: 'tp-ghost-sortable', dataIdAttr: 'data-record-id', onUpdate: (ev) => this.updateSortableList(ev)});
            }
        });
        onWillUpdateProps(nextProps => {
            // avoid first call for useEffect
            this._rpcFlag = true;
        });
        super.setup();
    }
    get isReadOnly() {
        let { isReadOnly } = this.props.extras;
        return isReadOnly;
    }
    get activePricelist() {
        let { activePricelist } = this.props.extras;
        return activePricelist;
    }
    get isBrand() {
        let { isBrand } = this.props.extras;
        return isBrand;
    }
    get recordsLimit() {
        let { recordsLimit } = this.props.extras;
        return recordsLimit || 20;
    }
    get hasSwitcher() {
        let { hasSwitcher } = this.props.extras;
        return hasSwitcher || false;
    }
    get fields() {
        let { fields } = this.props.extras;
        return fields || ['name'];
    }
    get SelectionMode() {
        let { mode } = this.props.extras;
        return mode || 'normal';
    }
    get fieldsToMarkup() {
        let { fieldsToMarkUp } = this.props.extras;
        return fieldsToMarkUp;
    }
    get environmentModel() {
        let { model } = this.props.componentData;
        return model;
    }
    get models() {
        let { models } = this.props.extras;
        return models || [this.environmentModel];
    }
    _getRecordsDomain (recordIds) {
        return [['id', 'in', recordIds || this.recordsIDs]];
    }

    getCategoryRecord (recordsID) {
        return this.fetchedCategoryData.find((record) => record.id === recordsID);
    }

    updateSortableList (ev) {
        this._notifyChanges('recordsIDs', this.sortables.toArray().map(Number).filter(Number));
    }

    _notifyChanges(key, value) {
        this.env.updateSelectionComponentValue(key, value, this.props.name);
        if (this.SelectionMode === 'badge') {
            this.env.recordsReady(this.records, this.props.name);
        }
    }
    get componentRegistry() {
        return { TpSearchInput: ['TpSearchInput'], TpDropDown: ['selectionType', 'model']};
    }
    get nodeOptions() {
        return {
            TpSearchInput: { defaultParams: { ... this.defaultParams }, recordsIDs: this.recordsIDs, model: this.environmentModel, fieldsToMarkup: this.fieldsToMarkup, brand: this.isBrand, hasSuggestion: this.SelectionMode !== 'badge'},
            selectionType: { buttonClasses: 'btn d-flex justify-content-between align-items-center btn-light bg-white border shadow-sm fw-light w-100 btn-sm', records: [{ id: 'manual', iconClass: 'fa fa-hand-pointer-o', title: _t("Manual") }, { id: 'advance', iconClass: 'fa fa-sliders', title: _t("Advance") }]},
            model: { buttonClasses: 'btn d-flex justify-content-between align-items-center btn-light bg-white border shadow-sm fw-light w-100 btn-sm', records: this.models.map((key) => { return { id: key, title: this.resModelInfo[key].title } })}
        };
    }
    // Override
    get componentDefaultVal() {
        return {...this.props.componentData};
    }
    get resModelInfo() {
        return {'product.template': { title: _t("Products") }, 'dr.product.label': { title: _t("Labels") }, 'product.tag': { title: _t("Tags") }, 'product.product': { title: _t("Variants") }, 'product.public.category': { title: _t("Categories") }, 'product.attribute.value': { title: _t("Brand")}};
    }
    performAction(action, value) {
        let recordsIDs = this.recordsIDs;
        switch (action) {
            case 'ADD':
            case 'ADD_ALL':
                let itemToAdd = action === 'ADD_ALL' ? value : [value];
                let limit = itemToAdd.length + this.recordsIDs.length;
                if (this.recordsLimit <= limit) {
                    let remainingSlot = limit - this.recordsLimit;
                    itemToAdd = itemToAdd.slice(0, itemToAdd.length - remainingSlot);
                }
                recordsIDs = action === 'ADD_ALL' ? itemToAdd : recordsIDs.concat(itemToAdd);
                break;
            case 'REPLACE':
                recordsIDs = value
                break;
            case 'REMOVE':
                // we can improve performance here
                recordsIDs = recordsIDs.filter(resID => resID !== value);
                break;
            case 'ADVANCE':
                // we can improve performance here
                this._notifyChanges(false, { selectionType: 'advance', domain_params: {...value} });
                break;
            case 'MODEL_CHANGE':
                let componentData = toRaw(this.props.componentData);
                componentData.selectionType === 'advance' ? componentData['domain_params'] = { domain: [], limit: 5, order: 'name asc' } : componentData['recordsIDs'] = [];
                this._notifyChanges(false, { ...componentData, model: value});
                return;
            case 'CHANGE':
                let params = { selectionType: value };
                if (value === 'advance') {
                    params = { ...params, domain_params: {domain: [], limit: 5, order: 'name asc'}};
                } else {
                    params = { ...params, recordsIDs: this.recordsIDs};
                }
                this._notifyChanges(false, params);
                return;
        }
        this.state.collectionState = 'draft';
        this._refreshRecords(recordsIDs);
    }
    _onChangeComponentValue(value, name) {
        if (name === 'model') {
            this.performAction("MODEL_CHANGE", value)
            return;
        }
        this.performAction("CHANGE", value)
    }
    async _refreshRecords(recordsIDs) {
        let params = { ...this.defaultParams, domain: this._getRecordsDomain(recordsIDs) };
        this.records = await this.componentService._fetchRecords(params, { fieldsToMarkup: this.fieldsToMarkup });
        if (this.environmentModel === 'product.public.category') {
            this.fetchedCategoryData = await this.componentService._fetchRecords({ options: { getCount: true, categoryIDs: recordsIDs }, fields: ['dr_category_label_id'] }, { routePath: '/theme_prime/get_categories_info' });
        }
        this.state.last_update = Date.now();
        this._notifyChanges('recordsIDs', recordsIDs);
    }
    _onClickRemoveItem (recordID) {
        this.performAction("REMOVE", recordID);
    }
    _onClickEditItem(recordID) {
        // useService instead :)
        // [TO-DO/TO-REMOVE] for myself
        // will not work in next version also sometimes the WOWL make
        // few stuff (state of the component) mashed up specially when user has access
        // to backend but some how we manage to by pass few things but this code is quite risky.
        this.actionService.doAction({
            type: 'ir.actions.act_window',
            res_model: this.environmentModel,
            res_id: recordID,
            views: [[false, 'form']],
            target: "new"
        }, {
            onClose: () => {
            this._refreshRecords(this.recordsIDs);
        }});
    }
    async _onClickCreateCollection() {
        await this.componentService._fetchRecords({ model: this.environmentModel, recordsIDs: this.recordsIDs, name: this.collectionInput.el.value }, { routePath: '/theme_prime/tp_create_collection' });
        this.state.collectionState = 'created';
    }
    _onClickClearItems() {
        this._notifyChanges('recordsIDs', []);
    }
    get fieldsLabel() {
        return { image: _t("Image"), name: _t("Name"), dr_brand_value_id: _t("Brand"), public_categ_ids: _t("Category"), dr_stock_label: _t("Availability")};
    }
    get getFieldsTemplates() {
        return {'public_categ_ids': 'tp_config_field_category','dr_brand_value_id': 'tp_config_field_brand','name': 'tp_config_field_product_name','dr_stock_label': 'tp_config_field_product_stock_label'};
    }
    get recordsIDs() {
        return this.props.componentData.recordsIDs || [];
    }
    get defaultParams() {
        return { model: this.environmentModel, fields: this.fields, limit: 10, extras: { activePricelist: this.activePricelist}};
    }
}
TpRecordSelector.template = 'theme_prime.TpRecordSelector';
registry.category('theme_components').add("TpRecordSelector", TpRecordSelector);