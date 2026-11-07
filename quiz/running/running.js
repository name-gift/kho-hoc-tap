
(function () {
    "use strict";

    /* ====================================================
       CONFIGURATION
    ==================================================== */

    const CONFIG = {
        WORKER_URL: "https://api-quiz.abcd1601ab.workers.dev",

        CHECK_PATH: "/check",
        QUIZ_PATH: "/quiz",

        WAYGROUND_URL: "https://wayground.com/pro/join?gc=",

        HOME_URL: "../",

        TIMEOUT: 20000,

        // Số lần kết nối lại sau lần thử đầu tiên
        MAX_RETRIES: 3,

        // Thời gian chờ giữa các lần kết nối lại
        RETRY_DELAY: 2000,

        // Thời gian đếm ngược khi thiết bị hết hạn
        EXPIRED_REDIRECT_DELAY: 5000,

        DEVICE_ID_KEY: "kho_tai_lieu_device_id_v1",
        DEVICE_TOKEN_KEY: "kho_tai_lieu_device_token_v1"
    };


    /* ====================================================
       STATE
    ==================================================== */

    const params = new URLSearchParams(
        window.location.search
    );

    const state = {
        code: (params.get("code") || "").trim(),
        loading: false,
        redirectTimer: null,
        countdownTimer: null
    };


    /* ====================================================
       HTML ELEMENTS
    ==================================================== */

    const elements = {
        frame: document.getElementById("quizFrame"),
        statusPage: document.getElementById("statusPage"),
        deviceOverlay: document.getElementById("deviceLoadingOverlay")
    };


    /* ====================================================
       LẤY THÔNG TIN THIẾT BỊ
    ==================================================== */

    function getCreds() {
        try {
            return {
                deviceId:
                    localStorage.getItem(
                        CONFIG.DEVICE_ID_KEY
                    ) || "",

                deviceToken:
                    localStorage.getItem(
                        CONFIG.DEVICE_TOKEN_KEY
                    ) || ""
            };

        } catch (error) {
            return {
                deviceId: "",
                deviceToken: ""
            };
        }
    }


    /* ====================================================
       XÓA TIMER
    ==================================================== */

    function clearCountdown() {
        if (state.countdownTimer !== null) {
            clearInterval(state.countdownTimer);
            state.countdownTimer = null;
        }
    }

    function clearRedirectTimer() {
        if (state.redirectTimer !== null) {
            clearTimeout(state.redirectTimer);
            state.redirectTimer = null;
        }
    }


    /* ====================================================
       ẨN LỚP TẢI THIẾT BỊ
    ==================================================== */

    function hideDeviceLoading() {
        if (!elements.deviceOverlay) {
            return;
        }

        elements.deviceOverlay.classList.add("hidden");
        elements.deviceOverlay.style.display = "none";
    }


    /* ====================================================
       CẬP NHẬT NỘI DUNG TẢI THIẾT BỊ
    ==================================================== */

    function updateDeviceLoading(title, message) {
        if (!elements.deviceOverlay) {
            return;
        }

        const heading =
            elements.deviceOverlay.querySelector("h3");

        const paragraph =
            elements.deviceOverlay.querySelector("p");

        if (heading) {
            heading.textContent = title;
        }

        if (paragraph) {
            paragraph.textContent = message;
        }
    }


    /* ====================================================
       HIỂN THỊ LỚP TẢI QUIZ
    ==================================================== */

    function showQuizLoading(
        title = "Đang tải Quiz",
        message = "Vui lòng chờ trong giây lát."
    ) {
        hideDeviceLoading();

        if (!elements.statusPage) {
            console.error(
                "Không tìm thấy statusPage."
            );

            return;
        }

        if (elements.frame) {
            elements.frame.style.display = "none";
            elements.frame.removeAttribute("src");
        }

        elements.statusPage.replaceChildren();
        elements.statusPage.style.display = "flex";

        const box = document.createElement("div");
        box.className = "device-loading-content";

        const icon = document.createElement("div");
        icon.className = "device-loading-icon";

        const spinner = document.createElement("div");
        spinner.className = "device-loading-spinner";

        const symbol = document.createElement("i");
        symbol.className = "fa-solid fa-graduation-cap";

        icon.appendChild(spinner);
        icon.appendChild(symbol);

        const heading = document.createElement("h3");
        heading.textContent = title;

        const paragraph = document.createElement("p");
        paragraph.textContent = message;

        const progress = document.createElement("div");
        progress.className = "device-loading-progress";

        const progressBar = document.createElement("span");
        progress.appendChild(progressBar);

        box.appendChild(icon);
        box.appendChild(heading);
        box.appendChild(paragraph);
        box.appendChild(progress);

        elements.statusPage.appendChild(box);
    }


    /* ====================================================
       HIỂN THỊ TRẠNG THÁI
    ==================================================== */

    function showStatus(
        type,
        title,
        message,
        symbol
    ) {
        clearCountdown();

        hideDeviceLoading();

        if (elements.frame) {
            elements.frame.style.display = "none";
            elements.frame.removeAttribute("src");
        }

        if (!elements.statusPage) {
            console.error(title, message);
            return null;
        }

        elements.statusPage.style.display = "flex";
        elements.statusPage.replaceChildren();

        const box = document.createElement("div");
        box.className = "status-box " + type;

        const icon = document.createElement("div");
        icon.className = "status-icon";
        icon.textContent = symbol || "!";

        const heading = document.createElement("h2");
        heading.textContent = title;

        const paragraph = document.createElement("p");
        paragraph.textContent = message;

        box.appendChild(icon);
        box.appendChild(heading);
        box.appendChild(paragraph);

        elements.statusPage.appendChild(box);

        return paragraph;
    }


    /* ====================================================
       HIỂN THỊ LỖI KẾT NỐI API
    ==================================================== */

    function showConnectionError(message) {
        showStatus(
            "error",
            "Không thể kết nối API",
            message ||
            "API không phản hồi sau nhiều lần thử. Vui lòng tải lại trang.",
            "!"
        );
    }


    /* ====================================================
       CHỜ TRƯỚC KHI KẾT NỐI LẠI
    ==================================================== */

    function delay(ms, signal) {
        return new Promise(function (resolve, reject) {
            if (signal && signal.aborted) {
                const error = new Error(
                    "Yêu cầu đã bị hủy."
                );

                error.name = "AbortError";
                reject(error);
                return;
            }

            const timer = setTimeout(function () {
                cleanup();
                resolve();
            }, ms);

            function onAbort() {
                clearTimeout(timer);
                cleanup();

                const error = new Error(
                    "Yêu cầu đã bị hủy."
                );

                error.name = "AbortError";
                reject(error);
            }

            function cleanup() {
                if (signal) {
                    signal.removeEventListener(
                        "abort",
                        onAbort
                    );
                }
            }

            if (signal) {
                signal.addEventListener(
                    "abort",
                    onAbort,
                    { once: true }
                );
            }
        });
    }


    /* ====================================================
       GỌI API WORKER VÀ TỰ ĐỘNG KẾT NỐI LẠI

       - Thử lần đầu.
       - Nếu không phản hồi, thử lại tối đa 3 lần.
       - Mỗi lần chờ tối đa 20 giây.
       - Chờ 2 giây giữa các lần thử.
       - Không thử lại lỗi xác thực thiết bị.
       - Hiển thị số lần kết nối lại: 1/3, 2/3, 3/3.
    ==================================================== */

    async function requestJSON(
        path,
        query = {},
        options = {}
    ) {
        const url = new URL(
            path,
            CONFIG.WORKER_URL
        );

        Object.entries(query).forEach(
            function ([key, value]) {
                if (
                    value !== null &&
                    value !== undefined &&
                    value !== ""
                ) {
                    url.searchParams.set(
                        key,
                        String(value)
                    );
                }
            }
        );

        const headers = {
            "Accept": "application/json"
        };

        if (options.deviceId) {
            headers["X-Device-Id"] =
                options.deviceId;
        }

        // /check không gửi token.
        // /quiz mới gửi token.

        if (
            options.sendToken === true &&
            options.deviceToken
        ) {
            headers["X-Device-Token"] =
                options.deviceToken;
        }


        /* ==========================================
           VÒNG LẶP KẾT NỐI
        ========================================== */

        for (
            let attempt = 0;
            attempt <= CONFIG.MAX_RETRIES;
            attempt++
        ) {
            if (
                options.signal &&
                options.signal.aborted
            ) {
                const error = new Error(
                    "Yêu cầu đã bị hủy."
                );

                error.name = "AbortError";
                throw error;
            }

            const attemptController =
                new AbortController();

            let timeoutId = null;
            let timedOut = false;

            function abortFromParent() {
                attemptController.abort();
            }

            if (options.signal) {
                options.signal.addEventListener(
                    "abort",
                    abortFromParent,
                    { once: true }
                );
            }

            try {
                timeoutId = setTimeout(
                    function () {
                        timedOut = true;
                        attemptController.abort();
                    },
                    CONFIG.TIMEOUT
                );

                const requestURL = new URL(
                    url.toString()
                );

                requestURL.searchParams.set(
                    "_refresh",
                    String(Date.now())
                );

                const response = await fetch(
                    requestURL.toString(),
                    {
                        method: "GET",
                        headers: headers,
                        cache: "no-store",
                        signal: attemptController.signal
                    }
                );

                const result = await response.json().catch(
                    function () {
                        throw new Error(
                            "API không trả về JSON hợp lệ."
                        );
                    }
                );

                const data =
                    result?.data &&
                    typeof result.data === "object"
                        ? result.data
                        : result;

                const errorCode = String(
                    result?.errorCode ||
                    result?.error ||
                    result?.code ||
                    data?.errorCode ||
                    data?.error ||
                    data?.code ||
                    data?.reason ||
                    ""
                ).trim().toUpperCase();


                /* DEVICE LOCKED */

                if (errorCode === "DEVICE_LOCKED") {
                    const error = new Error(
                        result?.message ||
                        data?.message ||
                        "Thiết bị đã bị khóa."
                    );

                    error.code = "DEVICE_LOCKED";
                    throw error;
                }


                /* DEVICE UNREGISTERED */

                if (
                    errorCode === "DEVICE_UNREGISTERED" ||
                    errorCode === "DEVICE_NOT_FOUND" ||
                    errorCode === "NOT_REGISTERED"
                ) {
                    const error = new Error(
                        result?.message ||
                        data?.message ||
                        "Thiết bị chưa được đăng ký."
                    );

                    error.code = "DEVICE_UNREGISTERED";
                    throw error;
                }


                /* DEVICE EXPIRED */

                if (
                    errorCode === "DEVICE_EXPIRED" ||
                    errorCode === "DEVICE_RENEW_REQUIRED"
                ) {
                    const error = new Error(
                        result?.message ||
                        data?.message ||
                        "Thiết bị đã hết hạn."
                    );

                    error.code = "DEVICE_EXPIRED";
                    throw error;
                }


                /* HTTP ERROR */

                if (!response.ok) {
                    const error = new Error(
                        result?.message ||
                        data?.message ||
                        "API trả về HTTP " + response.status
                    );

                    error.code = errorCode || "HTTP_ERROR";
                    error.status = response.status;

                    throw error;
                }


                /* API SEMANTIC ERROR */

                if (result?.success === false) {
                    const error = new Error(
                        result?.message ||
                        data?.message ||
                        "API từ chối yêu cầu."
                    );

                    error.code = errorCode || "API_ERROR";
                    throw error;
                }

                return result;

            } catch (error) {

                /* ==================================
                   DỌN DẸP
                ================================== */

                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                }

                if (options.signal) {
                    options.signal.removeEventListener(
                        "abort",
                        abortFromParent
                    );
                }


                /* ==================================
                   HỦY TỪ BÊN NGOÀI
                ================================== */

                if (
                    options.signal &&
                    options.signal.aborted
                ) {
                    const abortError = new Error(
                        "Yêu cầu đã bị hủy."
                    );

                    abortError.name = "AbortError";
                    throw abortError;
                }


                /* ==================================
                   LỖI KHÔNG ĐƯỢC THỬ LẠI
                ================================== */

                if (
                    error?.code === "DEVICE_LOCKED" ||
                    error?.code === "DEVICE_UNREGISTERED" ||
                    error?.code === "DEVICE_EXPIRED" ||
                    error?.code === "DEVICE_CHECK_FAILED" ||
                    error?.code === "API_ERROR" ||
                    (
                        error?.status >= 400 &&
                        error?.status < 500
                    )
                ) {
                    throw error;
                }


                /* ==================================
                   HẾT LƯỢT THỬ
                ================================== */

                if (attempt >= CONFIG.MAX_RETRIES) {
                    if (timedOut) {
                        const timeoutError = new Error(
                            "API không phản hồi sau " +
                            (CONFIG.MAX_RETRIES + 1) +
                            " lần thử. Mỗi lần chờ tối đa 20 giây."
                        );

                        timeoutError.code = "API_TIMEOUT";
                        throw timeoutError;
                    }

                    error.code =
                        error.code || "API_CONNECTION_FAILED";

                    throw error;
                }


                /* ==================================
                   THÔNG BÁO ĐANG KẾT NỐI LẠI

                   SỬA: 1/3 -> 2/3 -> 3/3
                ================================== */

                const nextAttempt = attempt + 1;

                if (typeof options.onRetry === "function") {
                    options.onRetry(
                        nextAttempt,
                        CONFIG.MAX_RETRIES,
                        error
                    );
                }

                console.warn(
                    "API không phản hồi. Đang kết nối lại...",
                    {
                        path: path,
                        attempt: nextAttempt,
                        error: error
                    }
                );

                await delay(
                    CONFIG.RETRY_DELAY,
                    options.signal
                );
            }
        }

        throw new Error(
            "Không thể kết nối API."
        );
    }


    /* ====================================================
       BƯỚC 1: KIỂM TRA THIẾT BỊ

       - Chỉ gửi deviceId.
       - Không gửi deviceToken.
       - Không tự đăng ký.
       - Không tự gia hạn.
       - Chỉ chấp nhận success: true và status: active.
    ==================================================== */

    async function checkDevice(
        deviceId,
        signal
    ) {
        const result = await requestJSON(
            CONFIG.CHECK_PATH,
            {
                deviceId: deviceId
            },
            {
                signal: signal,

                onRetry: function (attempt, total) {
                    updateDeviceLoading(
                        "Đang kết nối lại API",
                        "Mất kết nối. Đang thử kết nối lại (" +
                        attempt +
                        "/" +
                        total +
                        ")..."
                    );
                }
            }
        );

        const deviceData =
            result?.data &&
            typeof result.data === "object"
                ? result.data
                : result;

        const status = String(
            deviceData?.status ||
            deviceData?.deviceStatus ||
            ""
        ).trim().toLowerCase();

        const errorCode = String(
            result?.errorCode ||
            result?.error ||
            result?.code ||
            deviceData?.errorCode ||
            deviceData?.error ||
            deviceData?.code ||
            ""
        ).trim().toUpperCase();


        /* DEVICE LOCKED */

        if (
            errorCode === "DEVICE_LOCKED" ||
            deviceData?.locked === true ||
            status === "locked"
        ) {
            const error = new Error(
                result?.message ||
                deviceData?.message ||
                "Thiết bị đã bị khóa."
            );

            error.code = "DEVICE_LOCKED";
            throw error;
        }


        /* DEVICE EXPIRED */

        if (
            errorCode === "DEVICE_EXPIRED" ||
            errorCode === "DEVICE_RENEW_REQUIRED" ||
            deviceData?.expired === true ||
            status === "expired" ||
            status === "renew_required"
        ) {
            const error = new Error(
                result?.message ||
                deviceData?.message ||
                "Thiết bị đã hết hạn."
            );

            error.code = "DEVICE_EXPIRED";
            throw error;
        }


        /* DEVICE UNREGISTERED */

        if (
            errorCode === "DEVICE_UNREGISTERED" ||
            errorCode === "DEVICE_NOT_FOUND" ||
            errorCode === "NOT_REGISTERED" ||
            deviceData?.registered === false ||
            deviceData?.exists === false ||
            deviceData?.found === false ||
            status === "unregistered" ||
            status === "not_found"
        ) {
            const error = new Error(
                result?.message ||
                deviceData?.message ||
                "Thiết bị chưa được đăng ký."
            );

            error.code = "DEVICE_UNREGISTERED";
            throw error;
        }


        /* KIỂM TRA KẾT QUẢ */

        if (
            result?.success !== true ||
            status !== "active"
        ) {
            const error = new Error(
                result?.message ||
                deviceData?.message ||
                "Không xác minh được thiết bị."
            );

            error.code = "DEVICE_CHECK_FAILED";
            throw error;
        }


        /* LƯU TOKEN API TRẢ VỀ */

        const deviceToken = String(
            deviceData?.deviceToken || ""
        ).trim();

        if (deviceToken) {
            try {
                localStorage.setItem(
                    CONFIG.DEVICE_TOKEN_KEY,
                    deviceToken
                );

            } catch (error) {
                console.error(
                    "Không thể lưu deviceToken:",
                    error
                );
            }
        }

        return {
            success: true,
            status: status,

            deviceId:
                deviceData?.deviceId || deviceId,

            deviceToken: deviceToken,

            expiresAt:
                deviceData?.expiresAt || null
        };
    }


    /* ====================================================
       CHUYỂN ĐỔI THỜI GIAN QUIZ
       Chuỗi không có múi giờ mặc định UTC+07:00.
    ==================================================== */

    function parseTime(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        if (
            typeof value === "number" &&
            Number.isFinite(value)
        ) {
            const timestamp =
                value < 1000000000000
                    ? value * 1000
                    : value;

            return Number.isFinite(timestamp)
                ? timestamp
                : null;
        }

        const text = String(value).trim();

        if (/^\d{10}$/.test(text)) {
            const timestamp = Number(text) * 1000;

            return Number.isFinite(timestamp)
                ? timestamp
                : null;
        }

        if (/^\d{13}$/.test(text)) {
            const timestamp = Number(text);

            return Number.isFinite(timestamp)
                ? timestamp
                : null;
        }

        const hasExplicitTimezone =
            /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);

        const localDateTimePattern =
            /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

        let normalizedText = text;

        if (
            !hasExplicitTimezone &&
            localDateTimePattern.test(text)
        ) {
            normalizedText =
                text.replace(" ", "T") + "+07:00";
        }

        const parsed = Date.parse(normalizedText);

        if (!Number.isFinite(parsed)) {
            return null;
        }

        return parsed;
    }


    /* ====================================================
       KIỂM TRA THỜI GIAN QUIZ
    ==================================================== */

    function getQuizStatus(quiz) {
        const startTime = parseTime(
            quiz.startTime ??
            quiz.start_time ??
            quiz.start ??
            ""
        );

        const endTime = parseTime(
            quiz.endTime ??
            quiz.end_time ??
            quiz.end ??
            ""
        );

        const now = Date.now();

        if (
            startTime === null ||
            endTime === null ||
            startTime >= endTime
        ) {
            return {
                type: "error",
                title: "Không xác định được thời gian",
                message:
                    "Thời gian bắt đầu hoặc kết thúc của Quiz không hợp lệ.",
                canPlay: false
            };
        }

        if (now < startTime) {
            return {
                type: "upcoming",
                title: "Quiz này chưa mở",
                message:
                    "Vui lòng quay lại khi đến giờ bắt đầu.",
                canPlay: false
            };
        }

        if (now >= endTime) {
            return {
                type: "closed",
                title: "Quiz này đã đóng",
                message:
                    "Phiên Quiz đã hết thời gian tham gia.",
                canPlay: false
            };
        }

        return {
            type: "open",
            title: "Quiz đang mở",
            message: "Đang chuyển đến trang Quiz.",
            canPlay: true
        };
    }


    /* ====================================================
       MỞ QUIZ
    ==================================================== */

    function enterQuiz(code) {
        const quizCode = String(
            code ?? ""
        ).trim();

        if (!/^\d+$/.test(quizCode)) {
            showStatus(
                "error",
                "Mã Quiz không hợp lệ",
                "Không thể mở phiên Quiz với mã này.",
                "!"
            );

            return;
        }

        if (!elements.frame) {
            showStatus(
                "error",
                "Không tìm thấy khung Quiz",
                "Không tìm thấy phần tử quizFrame trong HTML.",
                "!"
            );

            return;
        }

        clearCountdown();

        if (elements.statusPage) {
            elements.statusPage.style.display = "none";
        }

        hideDeviceLoading();

        elements.frame.style.display = "block";

        elements.frame.src =
            CONFIG.WAYGROUND_URL +
            encodeURIComponent(quizCode);
    }


    /* ====================================================
       THIẾT BỊ HẾT HẠN
       ĐẾM NGƯỢC 5 -> 4 -> 3 -> 2 -> 1 -> 0
       SAU ĐÓ QUAY VỀ TRANG CHỦ
    ==================================================== */

    function redirectHomeAfterExpired() {
        clearCountdown();
        clearRedirectTimer();

        let remaining = 5;

        const paragraph = showStatus(
            "error",
            "Thiết bị đã hết hạn",
            "Đang chuyển về trang chủ sau " +
            remaining +
            " giây...",
            "!"
        );

        state.countdownTimer = setInterval(
            function () {
                remaining--;

                if (remaining <= 0) {
                    remaining = 0;

                    if (paragraph) {
                        paragraph.textContent =
                            "Đang chuyển về trang chủ sau 0 giây...";
                    }

                    clearCountdown();

                    state.redirectTimer = setTimeout(
                        function () {
                            window.location.replace(
                                CONFIG.HOME_URL
                            );
                        },
                        300
                    );

                    return;
                }

                if (paragraph) {
                    paragraph.textContent =
                        "Đang chuyển về trang chủ sau " +
                        remaining +
                        " giây...";
                }

            },
            1000
        );
    }


    /* ====================================================
       LUỒNG CHÍNH
    ==================================================== */

    async function checkQuiz() {
        if (state.loading) {
            return;
        }

        if (
            !state.code ||
            !/^\d+$/.test(state.code)
        ) {
            showStatus(
                "error",
                "Mã Quiz không hợp lệ",
                "Vui lòng kiểm tra lại đường dẫn tham gia Quiz.",
                "!"
            );

            return;
        }

        state.loading = true;

        /*
         * Ban đầu giữ nguyên deviceLoadingOverlay.
         * Không gọi showQuizLoading tại đây.
         */

        const controller = new AbortController();

        try {
            const creds = getCreds();


            /* ==========================================
               KIỂM TRA DEVICE ID
            ========================================== */

            if (!creds.deviceId) {
                const error = new Error(
                    "Không tìm thấy deviceId đã lưu. Vui lòng đăng ký thiết bị trước."
                );

                error.code = "DEVICE_UNREGISTERED";
                throw error;
            }


            /* ==========================================
               BƯỚC 1: CHECK THIẾT BỊ
            ========================================== */

            updateDeviceLoading(
                "Đang kiểm tra thiết bị",
                "Vui lòng chờ trong giây lát."
            );

            const deviceResult = await checkDevice(
                creds.deviceId,
                controller.signal
            );


            /* CẬP NHẬT TOKEN */

            if (deviceResult.deviceToken) {
                creds.deviceToken =
                    deviceResult.deviceToken;
            }


            /* ==========================================
               BƯỚC 2: ẨN TẢI THIẾT BỊ
               HIỆN TẢI QUIZ
            ========================================== */

            showQuizLoading(
                "Đang kiểm tra Quiz",
                "Thiết bị hợp lệ. Đang tải thông tin Quiz."
            );


            /* ==========================================
               BƯỚC 3: GỌI API QUIZ
            ========================================== */

            const responseData = await requestJSON(
                CONFIG.QUIZ_PATH,
                {
                    code: state.code
                },
                {
                    deviceId: creds.deviceId,
                    deviceToken: creds.deviceToken,
                    sendToken: true,
                    signal: controller.signal,

                    onRetry: function (attempt, total) {
                        showQuizLoading(
                            "Đang kết nối lại API",
                            "Mất kết nối. Đang thử kết nối lại (" +
                            attempt +
                            "/" +
                            total +
                            ")..."
                        );
                    }
                }
            );


            /* ==========================================
               KIỂM TRA API
            ========================================== */

            if (responseData?.success !== true) {
                showStatus(
                    "error",
                    "Không thể lấy thông tin Quiz",
                    responseData?.message ||
                    responseData?.error ||
                    "Worker không xác nhận yêu cầu thành công.",
                    "!"
                );

                return;
            }


            /* ==========================================
               LẤY DỮ LIỆU QUIZ
            ========================================== */

            const quiz =
                responseData?.data?.quiz ??
                responseData?.data ??
                responseData?.quiz;

            if (
                !quiz ||
                typeof quiz !== "object"
            ) {
                showStatus(
                    "error",
                    "API trả về thiếu dữ liệu Quiz",
                    "Phản hồi không chứa thông tin Quiz hợp lệ.",
                    "!"
                );

                return;
            }


            /* ==========================================
               KIỂM TRA MÃ QUIZ
            ========================================== */

            const apiCode = String(
                quiz.code ?? ""
            ).trim();

            const pageCode = String(
                state.code ?? ""
            ).trim();

            if (apiCode !== pageCode) {
                showStatus(
                    "error",
                    "Mã Quiz không khớp",
                    "Mã trên trang: " +
                    pageCode +
                    ". Mã từ API: " +
                    (apiCode || "(trống)") +
                    ".",
                    "!"
                );

                return;
            }


            /* ==========================================
               KIỂM TRA ACTIVE
            ========================================== */

            if (
                quiz.active === false ||
                String(quiz.active).toLowerCase() === "false"
            ) {
                showStatus(
                    "closed",
                    "Quiz hiện không hoạt động",
                    "Phiên Quiz này đã bị vô hiệu hóa.",
                    "×"
                );

                return;
            }


            /* ==========================================
               KIỂM TRA STATUS TỪ API
            ========================================== */

            const apiStatus = String(
                quiz.status ?? ""
            ).trim().toLowerCase();

            if (
                apiStatus === "closed" ||
                apiStatus === "expired"
            ) {
                showStatus(
                    "closed",
                    "Quiz này đã đóng",
                    "Phiên Quiz đã được đóng.",
                    "×"
                );

                return;
            }


            /* ==========================================
               KIỂM TRA THỜI GIAN QUIZ
            ========================================== */

            const quizStatus = getQuizStatus(quiz);

            if (!quizStatus.canPlay) {
                const symbol =
                    quizStatus.type === "upcoming"
                        ? "◷"
                        : quizStatus.type === "closed"
                            ? "×"
                            : "!";

                showStatus(
                    quizStatus.type,
                    quizStatus.title,
                    quizStatus.message,
                    symbol
                );

                return;
            }


            /* ==========================================
               KIỂM TRA LẦN CUỐI TRƯỚC KHI MỞ
            ========================================== */

            const finalStatus = getQuizStatus(quiz);

            if (!finalStatus.canPlay) {
                showStatus(
                    finalStatus.type,
                    finalStatus.title,
                    finalStatus.message,
                    finalStatus.type === "closed"
                        ? "×"
                        : "!"
                );

                return;
            }


            /* ==========================================
               MỞ QUIZ
            ========================================== */

            enterQuiz(quiz.code);


        } catch (error) {

            /* ==========================================
               API TIMEOUT / KHÔNG KẾT NỐI ĐƯỢC
            ========================================== */

            if (
                error?.code === "API_TIMEOUT" ||
                error?.code === "API_CONNECTION_FAILED" ||
                error?.code === "HTTP_ERROR"
            ) {
                showConnectionError(
                    error.message ||
                    "API không phản hồi sau nhiều lần thử. Vui lòng tải lại trang."
                );

                return;
            }


            /* ==========================================
               DEVICE LOCKED
            ========================================== */

            if (error?.code === "DEVICE_LOCKED") {
                showStatus(
                    "locked",
                    "Thiết bị đã bị khóa",
                    error.message ||
                    "Thiết bị này không được phép truy cập.",
                    "!"
                );

                return;
            }


            /* ==========================================
               DEVICE UNREGISTERED
            ========================================== */

            if (
                error?.code === "DEVICE_UNREGISTERED"
            ) {
                showStatus(
                    "error",
                    "Thiết bị chưa được đăng ký",
                    error.message ||
                    "Vui lòng đăng ký thiết bị trước khi tham gia Quiz.",
                    "!"
                );

                return;
            }


            /* ==========================================
               DEVICE EXPIRED
            ========================================== */

            if (
                error?.code === "DEVICE_EXPIRED"
            ) {
                redirectHomeAfterExpired();
                return;
            }


            /* ==========================================
               DEVICE CHECK FAILED
            ========================================== */

            if (
                error?.code === "DEVICE_CHECK_FAILED"
            ) {
                showStatus(
                    "error",
                    "Không xác minh được thiết bị",
                    error.message ||
                    "Không thể xác nhận quyền truy cập.",
                    "!"
                );

                return;
            }


            /* ==========================================
               OTHER ERRORS
            ========================================== */

            showStatus(
                "error",
                "Không thể kiểm tra Quiz",
                error?.message ||
                "Không tải được dữ liệu từ API. Vui lòng thử lại sau.",
                "!"
            );

        } finally {
            state.loading = false;
        }
    }


    /* ====================================================
       KHỞI CHẠY
    ==================================================== */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            checkQuiz,
            {
                once: true
            }
        );

    } else {
        checkQuiz();
    }

})();
