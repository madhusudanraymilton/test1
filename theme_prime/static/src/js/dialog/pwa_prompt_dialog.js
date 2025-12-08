/** @odoo-module **/

import { Dialog } from "@web/core/dialog/dialog";

export class PWAPromptDialog extends Dialog {
    static template = "theme_prime.PWAPromptDialog";
    static props = {
        ...Dialog.props,
        websiteID: { type: Number },
        isIOS: { type: Function },
        appName: { type: String },
        onInstall: { type: Function },
        onExit: { type: Function },
    };
    static defaultProps = {
        ...Dialog.defaultProps,
        technical: false,
        size: "md",
        bodyClass: "p-4 tp-pwa-prompt-dialog",
    };
    onInstall() {
        this.props.onInstall();
        return this.dismiss();
    }
    onExit () {
        return this.dismiss();
    }
}
