/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import { sprintf } from "@web/core/utils/strings";
import { cookie } from "@web/core/browser/cookie";
import { PWAPromptDialog } from "@theme_prime/js/dialog/pwa_prompt_dialog";
import { isIOS, isDisplayStandalone } from "@web/core/browser/feature_detection";

const html = document.documentElement;
const websiteID = html.getAttribute("data-website-id") || 0;

const deferredPrompt = new Promise(function (resolve, reject) {
    window.addEventListener("beforeinstallprompt", function (ev) {
        ev.preventDefault();
        resolve(ev);
    });
});

publicWidget.registry.PWAActivationEvents = publicWidget.Widget.extend({
    selector: "#wrapwrap",
    async start() {
        const superResult = await this._super(...arguments);
        if (odoo.dr_theme_config.pwa_active) {
            await this.activateServiceWorker();
        } else {
            await this.deactivateServiceWorker();
        }
        return superResult;
    },
    showInstallBanner() {
        if (!isDisplayStandalone()) {
            if (!cookie.get(sprintf("tp-pwa-popup-%s", websiteID))) {
                this.call("dialog", "add", PWAPromptDialog, {
                    websiteID: websiteID,
                    isIOS: isIOS(),
                    appName: odoo.dr_theme_config.pwa_name,
                    onInstall: () => {
                        deferredPrompt.then(prompt => {
                            prompt.prompt();
                        });
                    },
                }, {
                    onClose: () => {
                        cookie.set(sprintf("tp-pwa-popup-%s", websiteID), true);
                    },
                });
            }
        }
    },
    activateServiceWorker () {
        if (navigator.serviceWorker) {
            navigator.serviceWorker.register("/service_worker.js").then((registration) => {
                console.log("ServiceWorker registration successful with scope:", registration.scope);
                if (odoo.dr_theme_config.pwa_show_install_banner) {
                    if (isIOS()) {
                        this.showInstallBanner();
                    } else {
                        deferredPrompt.then(() => {
                            this.showInstallBanner();
                        });
                    }
                }
            }).catch(function (error) {
                console.log("ServiceWorker registration failed:", error);
            });
        }
    },
    deactivateServiceWorker () {
        if (navigator.serviceWorker) {
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
                registrations.forEach(r => {
                    r.unregister();
                    console.log("ServiceWorker removed successfully");
                });
            }).catch(function (err) {
                console.log("Service worker unregistration failed: ", err);
            });
        }
    },
});
