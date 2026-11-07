
"use strict";

(() => {
    if (window.__pageProtectionStarted) return;
    window.__pageProtectionStarted = true;

    /* =====================================================
       CONFIG
    ===================================================== */

    const API_URL =
        "https://api-quiz.abcd1601ab.workers.dev/";

    const DEVICE_KEY =
        "kho_tai_lieu_device_id_v1";

    const API_TIMEOUT = 20000;

    /* =====================================================
       STATE
    ===================================================== */

    let locked = false;
    let reporting = false;

    /* =====================================================
       DEVICE ID
       Chỉ lấy deviceId để gửi báo cáo khi cần thiết.
       Không gọi API kiểm tra thiết bị tại đây.
    ===================================================== */

    function getDeviceId() {
        let id = "";

        try {
            id = localStorage.getItem(DEVICE_KEY) || "";

            if (!id) {
                if (
                    typeof crypto !== "undefined" &&
                    typeof crypto.randomUUID === "function"
                ) {
                    id = crypto.randomUUID();
                } else {
                    id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
                        .replace(/[xy]/g, function (c) {
                            const r = Math.random() * 16 | 0;
                            const v = c === "x"
                                ? r
                                : (r & 0x3 | 0x8);

                            return v.toString(16);
                        });
                }

                localStorage.setItem(DEVICE_KEY, id);
            }

            return id;

        } catch (error) {
            console.error(
                "Không thể lấy deviceId:",
                error
            );

            return "";
        }
    }

    /* =====================================================
       API REPORT
       Chỉ gọi khi phát hiện hành vi bất thường.
    ===================================================== */

    async function reportAbnormalEvent(eventName) {
        const deviceId = getDeviceId();

        if (!deviceId) {
            throw new Error("Không lấy được deviceId.");
        }

        const url = new URL(API_URL);

        url.searchParams.set("action", "lock_device");
        url.searchParams.set("deviceId", deviceId);
        url.searchParams.set("event", eventName);
        url.searchParams.set(
            "userAgent",
            navigator.userAgent
        );
        url.searchParams.set(
            "_refresh",
            Date.now().toString()
        );

        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, API_TIMEOUT);

        try {
            const response = await fetch(url.toString(), {
                method: "GET",
                cache: "no-store",
                signal: controller.signal,
                headers: {
                    Accept: "application/json"
                }
            });

            let result;

            try {
                result = await response.json();
            } catch {
                throw new Error(
                    "Worker không trả về JSON hợp lệ."
                );
            }

            if (!response.ok) {
                const error = new Error(
                    result?.message ||
                    "Không thể gửi báo cáo lên Worker."
                );

                error.code = result?.code;
                error.status = response.status;

                throw error;
            }

            if (
                !result ||
                typeof result !== "object" ||
                Array.isArray(result)
            ) {
                throw new Error(
                    "Phản hồi từ Worker không hợp lệ."
                );
            }

            return result;

        } finally {
            clearTimeout(timeout);
        }
    }

    /* =====================================================
       REPORT AND RELOAD
    ===================================================== */

    async function reportAndReload(eventName) {
        if (locked || reporting) return;

        reporting = true;
        locked = true;

        try {
            console.warn(
                "Phát hiện hành vi bất thường:",
                eventName
            );

            const result = await reportAbnormalEvent(
                eventName
            );

            console.log(
                "Đã gửi báo cáo đến Worker:",
                result
            );

            // Chỉ tải lại khi Worker phản hồi hợp lệ.
            window.location.reload();

        } catch (error) {
            console.error(
                "Không gửi được báo cáo lên Worker:",
                error
            );

            reporting = false;
            locked = false;
        }
    }

    /* =====================================================
       KEYBOARD PROTECTION
    ===================================================== */

    document.addEventListener(
        "keydown",
        function (e) {
            const key = String(
                e.key || ""
            ).toLowerCase();

            const devtoolsShortcut =
                e.key === "F12" ||
                (
                    e.ctrlKey &&
                    e.shiftKey &&
                    ["i", "j", "c"].includes(key)
                ) ||
                (
                    e.ctrlKey &&
                    ["u", "s"].includes(key)
                );

            if (!devtoolsShortcut) return;

            e.preventDefault();
            e.stopImmediatePropagation();

            const eventName =
                e.ctrlKey && key === "s"
                    ? "ctrl_s"
                    : "devtools_shortcut:" + key;

            // Gửi báo cáo ngay khi phát hiện.
            void reportAndReload(eventName);
        },
        true
    );

    /* =====================================================
       DISABLE RIGHT CLICK
       Không gọi API.
    ===================================================== */

    document.addEventListener(
        "contextmenu",
        function (e) {
            e.preventDefault();
        },
        true
    );

    /* =====================================================
       DISABLE SELECTION WHEN LOCKED
    ===================================================== */

    document.addEventListener(
        "selectstart",
        function (e) {
            if (locked) {
                e.preventDefault();
            }
        },
        true
    );

})();
