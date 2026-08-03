(function () {
  "use strict";

  const THEME_KEY = "heritage-editor-ui-theme";
  const getSavedTheme = () => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch (_) {}
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  };

  function applyTheme(theme, persist) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    if (persist) {
      try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
    }
    const button = document.getElementById("themeToggle");
    if (button) {
      const isDark = next === "dark";
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", isDark ? "라이트 모드로 전환" : "다크 모드로 전환");
      button.querySelector(".theme-toggle__icon").textContent = isDark ? "☾" : "☀";
      button.querySelector(".theme-toggle__label").textContent = isDark ? "다크 모드" : "라이트 모드";
    }
    applyInterfaceLogos();
  }

  function applyInterfaceLogos() {
    if (typeof LOGO_1PCT === "undefined") return;
    document.querySelectorAll("img[data-pct-logo]").forEach(image => {
      const requested = image.dataset.pctLogo;
      const onDark = requested === "light" || (requested === "auto" && document.documentElement.dataset.theme === "dark");
      image.src = onDark ? LOGO_1PCT.light : LOGO_1PCT.dark;
    });
  }

  applyTheme(getSavedTheme(), false);

  const onReady = callback => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", callback, { once: true });
    else callback();
  };

  onReady(function initHeritageEnhancements() {
    if (typeof state === "undefined" || typeof renderCard !== "function" || typeof renderReel !== "function") return;

    state.imgOriginals = state.imgOriginals || {};
    state.imgOriginalBrands = state.imgOriginalBrands || {};
    state.cutoutApplied = state.cutoutApplied || {};
    state.cutoutSettings = state.cutoutSettings || {};

    applyInterfaceLogos();
    installThemeToggle();
    installObjectCover();
    installCutoutDialog();
    installUploadCapture();

    if (!COVER_STYLES.some(item => item.id === state.cover)) state.cover = "object";
    rebuildCoverChoices();
    reRender();

    function installThemeToggle() {
      const actionBar = document.querySelector(".top .bar");
      if (!actionBar || document.getElementById("themeToggle")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.id = "themeToggle";
      button.className = "btn ghost theme-toggle";
      button.innerHTML = '<span class="theme-toggle__icon" aria-hidden="true"></span><span class="theme-toggle__label"></span>';
      button.addEventListener("click", () => {
        const current = document.documentElement.dataset.theme;
        applyTheme(current === "dark" ? "light" : "dark", true);
      });
      const randomButton = document.getElementById("rand");
      actionBar.insertBefore(button, randomButton || actionBar.firstChild);
      applyTheme(document.documentElement.dataset.theme, false);
    }

    function installObjectCover() {
      /* 표지는 이미지 재사용 경로가 없는 매거진 커버 형식 하나로 고정한다. */
      COVER_STYLES.splice(0, COVER_STYLES.length,
        { id: "object", t: "매거진 커버" },
        { id: "copyC", t: "카피 중앙" },
        { id: "copyL", t: "카피 좌측" },
        { id: "tplA", t: "레퍼런스 A" },
        { id: "tplB", t: "레퍼런스 B" },
        { id: "tplC", t: "레퍼런스 C" });

      const baseRenderCard = renderCard;
      renderCard = function enhancedRenderCard(cardKey, palette, info) {
        if (cardKey === "cover" && state.cover === "object") return renderObjectCover(palette, info);
        return baseRenderCard(cardKey, palette, info);
      };

      const baseRenderReel = renderReel;
      renderReel = function enhancedRenderReel() {
        baseRenderReel();
        decorateCoverTools();
      };
    }

    function rebuildCoverChoices() {
      const host = document.getElementById("segCover");
      if (!host) return;
      host.innerHTML = COVER_STYLES.map(item =>
        `<button data-c="${item.id}" aria-pressed="${item.id === state.cover}">${item.t}</button>`
      ).join("");
    }

    function renderObjectCover(palette, info) {
      const brand = state.brand;
      const uploaded = state.imgs.cover;
      /* 표지는 cover 전용 배정만 사용한다. product/heroshot fallback은 중복을 만들므로 금지한다. */
      const coverAsset = !uploaded && catImgFor(brand, "cover");
      const source = uploaded || (coverAsset && (coverAsset.d || coverAsset.w)) || genBg(brand, "cover", palette);
      const isCutout = Boolean(state.cutoutApplied.cover && uploaded);
      const credit = uploaded
        ? (state.imgCredit ? `PHOTO · ${state.imgCredit}` : "")
        : (coverAsset ? `PHOTO · ${coverAsset.c.toUpperCase()} / ${(coverAsset.s || "UNSPLASH").toUpperCase()}` : "");
      const issue = String((seedOf(brand) % 98) + 1).padStart(2, "0");
      return `<div class="object-cover magazine-cover ${isCutout ? "has-cutout" : "has-photo"}" style="--bg:${palette.bg};--tx:${palette.tx};background:${palette.bg};color:#fff">
        <img class="object-cover__image ${isCutout ? "is-cutout" : "is-photo"}" src="${source}" alt="${brand} 매거진 표지">
        <div class="magazine-cover__scrim"></div>
        <div class="object-cover__top" style="justify-content:center">
          <span class="magazine-cover__publisher">${pctImg(3.1, true)}</span>
        </div>
        <div class="object-cover__footer">
          <div class="object-cover__wordmark">${wordmark(brand, uploaded ? 9.2 : 10.5, { bg: "#101010", tx: "#ffffff" })}</div>
          <div class="magazine-cover__coverline">Introducing the Brands that define the top 1% — vision, craft, and enduring influence.</div>
        </div>
        ${credit ? `<div class="photocred magazine-cover__credit">${credit}</div>` : ""}
      </div>`;
    }

    function decorateCoverTools() {
      const wrap = document.querySelector('.slidewrap[data-k="cover"]');
      if (!wrap) return;
      const existing = wrap.querySelector(".object-tools");
      if (existing) existing.remove();
      const automatic = !state.imgs.cover && catImgFor(state.brand, "cover");
      const canAdoptAutomatic = Boolean(automatic && automatic.cutoutEligible && (automatic.d || automatic.w));
      const hasImage = Boolean(state.imgs.cover || canAdoptAutomatic);
      const hasOriginal = Boolean(state.imgOriginals.cover && state.imgOriginalBrands.cover === state.brand);
      const hasCutout = Boolean(state.cutoutApplied.cover && state.imgs.cover);
      const tools = document.createElement("div");
      tools.className = "object-tools";
      tools.innerHTML = `
        <span class="object-tools__status">${hasCutout ? "투명 배경 적용됨" : state.imgs.cover ? "원본 보존됨 · 누끼 가능" : canAdoptAutomatic ? "대표 오브제 원본 · 바로 누끼 가능" : "표지 사진을 올리면 누끼 가능"}</span>
        <button type="button" data-cutout-open ${hasImage ? "" : "disabled"}>배경 제거</button>
        <button type="button" data-cutout-restore ${hasOriginal ? "" : "disabled"}>원본 복원</button>
        <button type="button" data-cutout-download ${hasCutout ? "" : "disabled"}>누끼 PNG</button>`;
      const adjust = wrap.querySelector(".adjrow");
      wrap.insertBefore(tools, adjust || null);
    }

    function installUploadCapture() {
      const fileInput = document.getElementById("fileInp");
      const reel = document.getElementById("reel");
      if (fileInput) {
        fileInput.addEventListener("change", event => {
          const file = event.target.files && event.target.files[0];
          const key = typeof uploadTarget === "string" ? uploadTarget : null;
          if (file && key) preserveOriginal(file, key);
        }, true);
      }
      if (reel) {
        reel.addEventListener("drop", event => {
          const wrap = event.target.closest && event.target.closest(".slidewrap");
          const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
          if (wrap && file && /^image\//.test(file.type)) preserveOriginal(file, wrap.dataset.k);
        }, true);
      }
      const brandInput = document.getElementById("bn");
      const randomButton = document.getElementById("rand");
      if (brandInput) brandInput.addEventListener("input", clearImageHistory);
      if (randomButton) randomButton.addEventListener("click", clearImageHistory);
      document.addEventListener("heritage:image-duplicate", event => showImagePolicyNotice(event.detail));
    }

    function preserveOriginal(file, key) {
      const reader = new FileReader();
      reader.onload = () => {
        const candidates = [...Object.entries(state.imgs), ...Object.entries(state.imgOriginals)];
        const duplicate = candidates.find(([otherKey, value]) => otherKey !== key && value === reader.result);
        if (duplicate) return;
        state.imgOriginals[key] = reader.result;
        state.imgOriginalBrands[key] = state.brand;
        delete state.cutoutApplied[key];
        delete state.cutoutSettings[key];
        if (key === "cover") decorateCoverTools();
      };
      reader.readAsDataURL(file);
    }

    let imagePolicyTimer = 0;
    function showImagePolicyNotice(detail) {
      let notice = document.getElementById("imagePolicyNotice");
      if (!notice) {
        notice = document.createElement("div");
        notice.id = "imagePolicyNotice";
        notice.className = "image-policy-notice";
        notice.setAttribute("role", "status");
        document.body.appendChild(notice);
      }
      const duplicateLabel = (CARDS.find(card => card.key === detail.duplicateKey) || {}).label || detail.duplicateKey;
      notice.textContent = `같은 이미지는 한 브랜드에서 한 번만 쓸 수 있어요. 이미 ${duplicateLabel}에 사용 중입니다.`;
      notice.classList.add("is-visible");
      clearTimeout(imagePolicyTimer);
      imagePolicyTimer = setTimeout(() => notice.classList.remove("is-visible"), 3200);
    }

    function clearImageHistory() {
      state.imgOriginals = {};
      state.imgOriginalBrands = {};
      state.cutoutApplied = {};
      state.cutoutSettings = {};
      decorateCoverTools();
    }

    function installCutoutDialog() {
      const panel = document.createElement("div");
      panel.id = "cutoutPanel";
      panel.className = "cutout-panel";
      panel.hidden = true;
      panel.innerHTML = `
        <div class="cutout-dialog" role="dialog" aria-modal="true" aria-labelledby="cutoutTitle">
          <div class="cutout-dialog__head">
            <div>
              <h2 class="cutout-dialog__title" id="cutoutTitle">표지 배경 제거</h2>
              <p class="cutout-dialog__desc">이미지는 서버로 전송되지 않고 이 브라우저 안에서만 처리됩니다.</p>
            </div>
            <button type="button" class="cutout-close" data-cutout-close aria-label="닫기">✕</button>
          </div>
          <div class="cutout-previews">
            <div class="cutout-preview">
              <span class="cutout-preview__label">원본</span>
              <div class="cutout-checker"><img id="cutoutOriginalPreview" alt="업로드 원본 미리보기"></div>
            </div>
            <div class="cutout-preview">
              <span class="cutout-preview__label">투명 PNG 결과</span>
              <div class="cutout-checker"><img id="cutoutResultPreview" alt="배경 제거 결과 미리보기"><span class="cutout-busy" id="cutoutBusy" hidden>배경 분석 중…</span></div>
            </div>
          </div>
          <div class="cutout-sliders">
            <label class="cutout-slider">
              <span class="cutout-slider__label"><span>제거 범위</span><output id="cutoutThresholdValue">48</output></span>
              <input id="cutoutThreshold" type="range" min="8" max="180" value="48">
              <span class="cutout-slider__help">높일수록 배경과 비슷한 색을 더 넓게 제거합니다.</span>
            </label>
            <label class="cutout-slider">
              <span class="cutout-slider__label"><span>가장자리 부드러움</span><output id="cutoutSoftnessValue">28</output></span>
              <input id="cutoutSoftness" type="range" min="0" max="100" value="28">
              <span class="cutout-slider__help">오브제 경계의 투명 전환 폭을 조절합니다.</span>
            </label>
          </div>
          <p class="cutout-note"><b>자동 누끼 안내</b> · 흰색·단색·스튜디오 배경에 최적화되어 있습니다. 복잡한 야외 배경이나 오브제가 모서리에 닿은 사진은 일부가 남거나 지워질 수 있습니다.</p>
          <p class="cutout-message" id="cutoutMessage" aria-live="polite"></p>
          <div class="cutout-actions">
            <button type="button" class="btn ghost" data-cutout-default>기본값</button>
            <button type="button" class="btn ghost" data-cutout-restore>원본 복원</button>
            <button type="button" class="btn ghost" data-cutout-download>누끼 PNG 저장</button>
            <button type="button" class="btn" data-cutout-close>표지에 적용 완료</button>
          </div>
        </div>`;
      document.body.appendChild(panel);

      let debounceTimer = null;
      let jobId = 0;
      const threshold = panel.querySelector("#cutoutThreshold");
      const softness = panel.querySelector("#cutoutSoftness");
      const thresholdValue = panel.querySelector("#cutoutThresholdValue");
      const softnessValue = panel.querySelector("#cutoutSoftnessValue");
      const originalPreview = panel.querySelector("#cutoutOriginalPreview");
      const resultPreview = panel.querySelector("#cutoutResultPreview");
      const busy = panel.querySelector("#cutoutBusy");
      const message = panel.querySelector("#cutoutMessage");

      document.addEventListener("click", event => {
        if (event.target.closest("[data-cutout-open]")) openPanel();
        if (event.target.closest("[data-cutout-close]")) closePanel();
        if (event.target.closest("[data-cutout-restore]")) restoreOriginal();
        if (event.target.closest("[data-cutout-download]")) downloadCutout();
        if (event.target.closest("[data-cutout-default]")) {
          threshold.value = "48";
          softness.value = "28";
          updateLabels();
          scheduleCutout(0);
        }
      });

      panel.addEventListener("click", event => {
        if (event.target === panel) closePanel();
      });
      document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !panel.hidden) closePanel();
      });
      [threshold, softness].forEach(input => input.addEventListener("input", () => {
        updateLabels();
        scheduleCutout(130);
      }));

      function openPanel() {
        if (!state.imgs.cover) {
          const automatic = catImgFor(state.brand, "cover");
          const source = automatic && automatic.cutoutEligible && (automatic.d || automatic.w);
          if (!source) return;
          state.imgs.cover = source;
          state.imgOriginals.cover = source;
          state.imgOriginalBrands.cover = state.brand;
          delete state.cutoutApplied.cover;
          delete state.cutoutSettings.cover;
          patchCard("cover");
          decorateCoverTools();
        }
        if (!state.imgOriginals.cover || state.imgOriginalBrands.cover !== state.brand) {
          state.imgOriginals.cover = state.imgs.cover;
          state.imgOriginalBrands.cover = state.brand;
          delete state.cutoutApplied.cover;
          delete state.cutoutSettings.cover;
        }
        const settings = state.cutoutSettings.cover || { threshold: 48, softness: 28 };
        threshold.value = String(settings.threshold);
        softness.value = String(settings.softness);
        originalPreview.src = state.imgOriginals.cover;
        resultPreview.src = state.imgs.cover;
        updateLabels();
        message.className = "cutout-message";
        message.textContent = "모서리 배경색을 분석해 투명 영역을 만드는 중입니다.";
        panel.hidden = false;
        document.body.style.overflow = "hidden";
        panel.querySelector(".cutout-close").focus();
        scheduleCutout(0);
      }

      function closePanel() {
        panel.hidden = true;
        document.body.style.overflow = "";
      }

      function updateLabels() {
        thresholdValue.value = threshold.value;
        thresholdValue.textContent = threshold.value;
        softnessValue.value = softness.value;
        softnessValue.textContent = softness.value;
      }

      function scheduleCutout(delay) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runCutout, delay);
      }

      async function runCutout() {
        const original = state.imgOriginals.cover;
        if (!original) return;
        const thisJob = ++jobId;
        busy.hidden = false;
        message.className = "cutout-message";
        message.textContent = "배경과 연결된 모서리 색상을 분석하고 있습니다…";
        try {
          const settings = { threshold: Number(threshold.value), softness: Number(softness.value) };
          const result = await removeBackground(original, settings.threshold, settings.softness);
          if (thisJob !== jobId) return;
          state.imgs.cover = result;
          state.cutoutApplied.cover = true;
          state.cutoutSettings.cover = settings;
          resultPreview.src = result;
          patchCard("cover");
          decorateCoverTools();
          message.textContent = "투명 PNG가 표지에 적용되었습니다. PNG 내보내기에도 같은 결과가 반영됩니다.";
        } catch (error) {
          if (thisJob !== jobId) return;
          message.className = "cutout-message is-error";
          message.textContent = "배경 제거에 실패했습니다. 다른 이미지로 다시 시도해 주세요.";
        } finally {
          if (thisJob === jobId) busy.hidden = true;
        }
      }

      function restoreOriginal() {
        if (!state.imgOriginals.cover || state.imgOriginalBrands.cover !== state.brand) return;
        ++jobId;
        state.imgs.cover = state.imgOriginals.cover;
        delete state.cutoutApplied.cover;
        delete state.cutoutSettings.cover;
        resultPreview.src = state.imgs.cover;
        patchCard("cover");
        decorateCoverTools();
        message.className = "cutout-message";
        message.textContent = "업로드 원본으로 복원했습니다. 원본은 계속 보존됩니다.";
      }

      function downloadCutout() {
        if (!state.cutoutApplied.cover || !state.imgs.cover) return;
        const link = document.createElement("a");
        link.download = `${safe(state.brand)}_cover_cutout.png`;
        link.href = state.imgs.cover;
        link.click();
      }
    }

    async function removeBackground(source, threshold, softness) {
      const image = await loadImage(source);
      const maxSide = 2160;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, width, height);
      const frame = context.getImageData(0, 0, width, height);
      const pixels = frame.data;
      const cornerColors = sampleCornerColors(pixels, width, height);
      const distance = new Uint16Array(width * height);
      const upper = Math.min(442, threshold + Math.max(1, softness));

      for (let index = 0, pixel = 0; index < distance.length; index += 1, pixel += 4) {
        if (pixels[pixel + 3] === 0) {
          distance[index] = 0;
          continue;
        }
        let nearest = 65535;
        for (const color of cornerColors) {
          const red = pixels[pixel] - color[0];
          const green = pixels[pixel + 1] - color[1];
          const blue = pixels[pixel + 2] - color[2];
          const value = Math.sqrt(2 * red * red + 4 * green * green + 3 * blue * blue) / 3;
          if (value < nearest) nearest = value;
        }
        distance[index] = Math.round(nearest);
      }

      const connected = floodBackground(distance, width, height, upper);
      const feather = Math.max(0, softness);
      for (let index = 0, pixel = 0; index < connected.length; index += 1, pixel += 4) {
        if (!connected[index]) continue;
        let alphaFactor;
        if (feather === 0) alphaFactor = distance[index] <= threshold ? 0 : 1;
        else {
          const ratio = Math.max(0, Math.min(1, (distance[index] - threshold) / feather));
          alphaFactor = ratio * ratio * (3 - 2 * ratio);
        }
        pixels[pixel + 3] = Math.round(pixels[pixel + 3] * alphaFactor);
      }

      context.putImageData(frame, 0, 0);
      return canvas.toDataURL("image/png");
    }

    function loadImage(source) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = source;
      });
    }

    function sampleCornerColors(pixels, width, height) {
      const sampleWidth = Math.max(2, Math.min(32, Math.round(width * .045)));
      const sampleHeight = Math.max(2, Math.min(32, Math.round(height * .045)));
      const corners = [
        [0, 0],
        [width - sampleWidth, 0],
        [0, height - sampleHeight],
        [width - sampleWidth, height - sampleHeight]
      ];
      return corners.map(([startX, startY]) => {
        let red = 0, green = 0, blue = 0, weight = 0;
        for (let y = startY; y < startY + sampleHeight; y += 1) {
          for (let x = startX; x < startX + sampleWidth; x += 1) {
            const offset = (y * width + x) * 4;
            const alpha = pixels[offset + 3] / 255;
            if (!alpha) continue;
            red += pixels[offset] * alpha;
            green += pixels[offset + 1] * alpha;
            blue += pixels[offset + 2] * alpha;
            weight += alpha;
          }
        }
        if (!weight) return [255, 255, 255];
        return [red / weight, green / weight, blue / weight];
      });
    }

    function floodBackground(distance, width, height, upper) {
      const total = width * height;
      const connected = new Uint8Array(total);
      const queue = new Int32Array(total);
      let head = 0;
      let tail = 0;
      const add = index => {
        if (connected[index] || distance[index] > upper) return;
        connected[index] = 1;
        queue[tail++] = index;
      };

      for (let x = 0; x < width; x += 1) {
        add(x);
        add((height - 1) * width + x);
      }
      for (let y = 1; y < height - 1; y += 1) {
        add(y * width);
        add(y * width + width - 1);
      }

      while (head < tail) {
        const index = queue[head++];
        const x = index % width;
        if (x > 0) add(index - 1);
        if (x < width - 1) add(index + 1);
        if (index >= width) add(index - width);
        if (index < total - width) add(index + width);
      }
      return connected;
    }

    window.HeritageEditorEnhancements = { applyTheme, removeBackground };
  });
})();
