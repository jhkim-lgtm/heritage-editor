(function () {
  "use strict";

  const CARD_KEYS = ["cover", "heritage", "founder", "product", "heroshot", "behind", "quote", "closing"];
  const COMMONS_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
  const ASSET_CACHE = Object.create(null);
  const BRIEF_CACHE = Object.create(null);
  const STATUS = Object.create(null);
  const PENDING = Object.create(null);
  const SEARCH_CACHE = new Map();
  const STOP_WORDS = new Set(["and", "the", "de", "du", "des", "la", "le", "les", "of", "et", "co", "cie", "maison", "hotel", "hotels", "paris"]);
  const GENERIC_SUBJECT_WORDS = new Set(["brand", "house", "historic", "iconic", "signature", "product", "object", "detail", "material", "emblem", "motif", "workshop", "flagship", "headquarters", "architecture", "close", "sports", "travel", "family", "store", "boutique", "factory", "atelier", "salon", "manufacture", "resort", "pavilion", "entrance", "black", "white", "dark", "yellow", "red", "blue", "green", "quilted", "grained", "natural", "hand", "finished"]);
  const OBJECT_WORDS = new Set(["bag", "handbag", "trunk", "perfume", "parfum", "bottle", "flacon", "watch", "wristwatch", "bracelet", "ring", "necklace", "jewel", "car", "automobile", "coupe", "chair", "sofa", "lamp", "light", "camera", "lens", "pen", "nib", "shoe", "loafer", "boot", "coat", "jacket", "scarf", "suitcase", "refrigerator", "toaster", "speaker", "loudspeaker", "amplifier", "decanter", "glass", "candle", "jar", "balm", "cigar", "box"]);
  const PLACE_WORDS = new Set(["building", "store", "shop", "factory", "headquarters", "maison", "house", "hotel", "resort", "museum", "atelier", "workshop", "salon", "manufacture", "boutique", "pavilion", "entrance", "street", "avenue"]);
  const NATURE_SYMBOL_WORDS = new Set(["camellia", "flower", "rose", "lily", "clover", "bird", "horse", "tiger", "panther", "serpent", "snake", "bull", "lion", "eagle", "bee", "butterfly", "star", "moon", "sun", "tree", "leaf", "vine"]);
  const QUERY_NOISE = /\b(product|close(?:-?up)?|history|historic|building|flagship|headquarters|architecture|craftsmanship|hand-finished|signature|iconic|house|black|white|dark|yellow|quilted|grained)\b/gi;

  const CATEGORY_PROFILE = {
    fashion: { object: "signature handbag or garment", alternate: "house accessory", material: "signature textile or leather", motif: "house emblem", place: "historic atelier or flagship" },
    eyewear: { object: "signature eyeglasses", alternate: "sunglasses frame", material: "acetate and metal detail", motif: "temple hinge", place: "optical workshop" },
    watch: { object: "signature wristwatch", alternate: "watch dial", material: "movement and watchmaking metal", motif: "crown or calibre", place: "watch manufacture" },
    jewelry: { object: "signature jewel", alternate: "iconic necklace or ring", material: "precious metal and gemstone", motif: "house jewelry motif", place: "historic jewelry salon" },
    fragrance: { object: "signature perfume bottle", alternate: "fragrance flacon", material: "glass and perfume essence", motif: "botanical ingredient", place: "historic perfumery" },
    beauty: { object: "hero skincare or beauty product", alternate: "signature bottle or jar", material: "cream and glass texture", motif: "hero botanical ingredient", place: "brand laboratory or flagship" },
    leather: { object: "signature leather bag or trunk", alternate: "leather travel object", material: "hand-finished leather", motif: "lock or clasp", place: "leather atelier" },
    footwear: { object: "signature shoe", alternate: "iconic loafer or heel", material: "hand-finished leather and sole", motif: "shoe last", place: "shoemaking workshop" },
    auto: { object: "signature automobile", alternate: "iconic sports car", material: "coachbuilt metal and leather", motif: "hood ornament or marque emblem", place: "historic factory or headquarters" },
    hotel: { object: "iconic hotel architecture", alternate: "signature hotel interior", material: "stone wood and hospitality detail", motif: "entrance or key", place: "flagship hotel building" },
    spirits: { object: "signature spirit bottle", alternate: "historic decanter", material: "amber spirit and oak", motif: "distillery crest", place: "historic distillery" },
    wine: { object: "signature wine or champagne bottle", alternate: "historic cuvée", material: "glass cork and cellar texture", motif: "vine or estate crest", place: "historic château or cellar" },
    furniture: { object: "iconic chair or furniture piece", alternate: "signature furniture design", material: "wood leather and upholstery", motif: "joinery detail", place: "design workshop or headquarters" },
    lighting: { object: "iconic lamp", alternate: "signature light fixture", material: "glass metal and diffused light", motif: "shade or reflector", place: "lighting workshop" },
    tableware: { object: "signature crystal or porcelain object", alternate: "iconic vessel", material: "crystal porcelain or silver", motif: "house pattern", place: "historic manufactory" },
    audio: { object: "signature loudspeaker or amplifier", alternate: "iconic audio object", material: "aluminium wood and acoustic fabric", motif: "driver or control dial", place: "audio laboratory" },
    camera: { object: "signature camera or lens", alternate: "iconic camera body", material: "optical glass and machined metal", motif: "lens aperture", place: "optics factory" },
    writing: { object: "signature fountain pen", alternate: "iconic writing instrument", material: "lacquer resin and gold nib", motif: "pen nib", place: "writing instrument workshop" },
    kitchen: { object: "signature kitchen appliance or cookware", alternate: "iconic kitchen object", material: "enamel steel or copper", motif: "control or handle detail", place: "historic factory or showroom" },
    cigars: { object: "signature cigar and presentation box", alternate: "iconic cigar", material: "tobacco leaf and cedar", motif: "cigar band", place: "historic cigar factory" },
    default: { object: "signature product", alternate: "iconic house object", material: "signature material", motif: "house emblem", place: "historic atelier or flagship" }
  };

  const PROFILE_OVERRIDES = {
    "Hermès": { primary: "Birkin bag", alternate: "Kelly bag", material: "orange grained leather and saddle stitch", motif: "horse and equestrian harness", landmark: "24 Rue du Faubourg Saint-Honoré flagship" },
    "Chanel": { primary: "Chanel N°5 perfume bottle", alternate: "2.55 quilted handbag", material: "black quilted leather and tweed", motif: "white camellia", landmark: "31 Rue Cambon flagship" },
    "Louis Vuitton": { primary: "Louis Vuitton travel trunk", alternate: "Speedy handbag", material: "monogram canvas and natural leather", motif: "LV flower motif", landmark: "Asnières family workshop" },
    "Gucci": { primary: "Bamboo 1947 handbag", alternate: "Horsebit loafer", material: "bamboo leather and GG canvas", motif: "horsebit and tiger", landmark: "Gucci Garden Palazzo della Mercanzia Florence" },
    "Dior": { primary: "Lady Dior handbag", alternate: "Bar jacket", material: "cannage quilting and toile", motif: "lucky star and lily of the valley", landmark: "30 Avenue Montaigne flagship" },
    "Prada": { primary: "black nylon backpack", alternate: "Galleria Saffiano bag", material: "Re-Nylon and Saffiano leather", motif: "triangle plaque", landmark: "Galleria Vittorio Emanuele II boutique" },
    "Bottega Veneta": { primary: "Andiamo intrecciato bag", alternate: "Knot clutch", material: "intrecciato woven leather", motif: "knot", landmark: "Montebello Vicentino atelier" },
    "Burberry": { primary: "heritage trench coat", alternate: "check scarf", material: "gabardine and house check", motif: "equestrian knight", landmark: "Horseferry House London" },
    "Loewe": { primary: "Puzzle bag", alternate: "Elephant bag", material: "Spanish leather and woven raffia", motif: "anagram and elephant", landmark: "Casa Loewe Madrid" },
    "Maison Margiela": { primary: "Tabi boot", alternate: "5AC bag", material: "white basting stitch and deconstructed leather", motif: "four white stitches", landmark: "Paris atelier" },
    "Rolex": { primary: "Oyster Perpetual wristwatch", alternate: "Submariner watch", material: "Oystersteel and fluted bezel", motif: "five-point crown", landmark: "Rolex manufacture Geneva" },
    "Patek Philippe": { primary: "Calatrava wristwatch", alternate: "Nautilus watch", material: "hand-finished movement and gold", motif: "Calatrava cross", landmark: "Plan-les-Ouates manufacture" },
    "Audemars Piguet": { primary: "Royal Oak wristwatch", alternate: "octagonal watch bezel", material: "brushed steel and tapisserie dial", motif: "octagon", landmark: "Le Brassus manufacture" },
    "Cartier": { primary: "Tank wristwatch", alternate: "Aldo Cipullo Love bracelet", material: "yellow gold and red leather", motif: "panther", landmark: "13 Rue de la Paix flagship" },
    "Omega": { primary: "Speedmaster Moonwatch", alternate: "Seamaster watch", material: "steel black dial and calibre", motif: "Greek omega symbol", landmark: "Bienne manufacture" },
    "Tiffany & Co.": { primary: "Tiffany Setting diamond ring", alternate: "Tiffany Blue Box", material: "platinum diamond and Tiffany blue", motif: "bird on a rock", landmark: "The Landmark Fifth Avenue" },
    "Van Cleef & Arpels": { primary: "Alhambra necklace", alternate: "Zip necklace", material: "mother-of-pearl and yellow gold", motif: "four-leaf clover", landmark: "Place Vendôme boutique" },
    "Bvlgari": { primary: "Serpenti bracelet watch", alternate: "B.zero1 ring", material: "Roman gold and colored gemstones", motif: "serpent", landmark: "Via Condotti flagship Rome" },
    "Aesop": { primary: "amber apothecary bottle", alternate: "Resurrection hand balm tube", material: "amber glass and botanical texture", motif: "apothecary label", landmark: "Aesop signature store architecture" },
    "Le Labo": { primary: "Santal 33 perfume bottle", alternate: "hand-labelled fragrance bottle", material: "amber liquid glass and kraft paper", motif: "laboratory label", landmark: "Nolita perfumery" },
    "Diptyque": { primary: "Baies oval-label candle", alternate: "Orphéon perfume bottle", material: "black wax glass and paper label", motif: "oval medallion", landmark: "34 Boulevard Saint-Germain boutique" },
    "Creed": { primary: "Aventus perfume bottle", alternate: "green leather fragrance flacon", material: "dark glass and silver", motif: "horse and rider", landmark: "historic Paris boutique" },
    "La Mer": { primary: "Crème de la Mer jar", alternate: "Miracle Broth bottle", material: "frosted glass cream and sea kelp", motif: "sea kelp", landmark: "La Mer laboratory" },
    "Rolls-Royce": { primary: "Phantom motor car", alternate: "Cullinan automobile", material: "coachbuilt aluminium wood and leather", motif: "Spirit of Ecstasy hood ornament", landmark: "Goodwood manufacturing plant" },
    "Ferrari": { primary: "250 GTO sports car", alternate: "Ferrari F40", material: "Rosso Corsa aluminium and carbon fibre", motif: "prancing horse", landmark: "Maranello factory entrance" },
    "Porsche": { primary: "Porsche 911 sports car", alternate: "356 coupe", material: "painted steel and leather", motif: "round headlight and crest", landmark: "Zuffenhausen factory" },
    "Lamborghini": { primary: "Countach supercar", alternate: "Miura sports car", material: "wedge-shaped aluminium and carbon fibre", motif: "raging bull", landmark: "Sant'Agata Bolognese factory" },
    "Bentley": { primary: "Continental GT", alternate: "Bentley Blower", material: "British racing green metal wood and leather", motif: "winged B hood emblem", landmark: "Crewe factory" },
    "Aman": { primary: "Aman Tokyo architecture", alternate: "Amangiri desert pavilion", material: "stone water and quiet timber", motif: "minimal pavilion", landmark: "iconic Aman resort architecture" },
    "The Macallan": { primary: "Macallan single malt bottle", alternate: "Macallan Lalique decanter", material: "amber whisky oak and glass", motif: "Easter Elchies House", landmark: "Macallan Speyside distillery" },
    "Hennessy": { primary: "Hennessy XO decanter", alternate: "Richard Hennessy carafe", material: "cognac crystal and oak", motif: "bras armé emblem", landmark: "Hennessy Maison Cognac" },
    "Dom Pérignon": { primary: "Dom Pérignon champagne bottle", alternate: "shield label cuvée", material: "dark glass cork and champagne", motif: "monastic shield", landmark: "Hautvillers abbey cellar" },
    "Vitra": { primary: "Panton Chair", alternate: "Eames Lounge Chair", material: "molded plastic plywood and leather", motif: "chair silhouette", landmark: "Vitra Campus architecture" },
    "Cassina": { primary: "LC4 chaise longue", alternate: "Cab chair", material: "tubular steel and saddle leather", motif: "modernist frame", landmark: "Cassina Meda factory" },
    "Herman Miller": { primary: "Eames Lounge Chair", alternate: "Aeron chair", material: "molded plywood leather and mesh", motif: "shell chair silhouette", landmark: "Herman Miller Design Yard" },
    "Fritz Hansen": { primary: "Egg Chair", alternate: "Series 7 chair", material: "molded plywood and leather", motif: "sculptural chair shell", landmark: "Fritz Hansen Copenhagen showroom" },
    "Flos": { primary: "Arco floor lamp", alternate: "Snoopy table lamp", material: "Carrara marble steel and glass", motif: "arched light", landmark: "Flos Milan showroom" },
    "Louis Poulsen": { primary: "PH Artichoke lamp", alternate: "PH 5 pendant", material: "layered metal and diffused light", motif: "concentric shade", landmark: "Louis Poulsen Copenhagen" },
    "Baccarat": { primary: "Harcourt crystal glass", alternate: "Zénith chandelier", material: "cut crystal and red lacquer", motif: "red octagonal crystal", landmark: "Baccarat manufactory" },
    "Bang & Olufsen": { primary: "Beosound 9000", alternate: "Beolab 90 loudspeaker", material: "brushed aluminium wood and acoustic fabric", motif: "circular control", landmark: "Struer factory" },
    "McIntosh": { primary: "blue-meter amplifier", alternate: "MC275 tube amplifier", material: "black glass steel and vacuum tubes", motif: "blue power meter", landmark: "Binghamton audio factory" },
    "Leica": { primary: "Leica M rangefinder camera", alternate: "Noctilux lens", material: "black brass optical glass and leather", motif: "red dot and viewfinder", landmark: "Leitz Park Wetzlar" },
    "Hasselblad": { primary: "Hasselblad 500C camera", alternate: "X2D camera", material: "black leather chrome and optical glass", motif: "square viewfinder", landmark: "Gothenburg camera workshop" },
    "Montblanc": { primary: "Meisterstück 149 fountain pen", alternate: "gold nib", material: "black precious resin and gold", motif: "white snowcap", landmark: "Montblanc Haus Hamburg" },
    "La Cornue": { primary: "Château range cooker", alternate: "copper rotisserie", material: "enameled steel brass and copper", motif: "arched oven door", landmark: "La Cornue Paris showroom" },
    "Smeg": { primary: "FAB28 refrigerator", alternate: "1950s toaster", material: "gloss enamel and chrome", motif: "rounded retro silhouette", landmark: "Smeg Guastalla headquarters" },
    "Goyard": { primary: "Saint Louis tote", alternate: "Bourget trunk", material: "Goyardine canvas and leather", motif: "chevron pattern", landmark: "233 Rue Saint-Honoré boutique" },
    "Rimowa": { primary: "Original aluminium suitcase", alternate: "grooved travel trunk", material: "anodized aluminium and leather", motif: "parallel grooves", landmark: "Rimowa Cologne factory" },
    "Christian Louboutin": { primary: "red-sole pump", alternate: "Pigalle stiletto", material: "black patent leather and red lacquer", motif: "red sole", landmark: "Rue Jean-Jacques Rousseau boutique" }
  };

  const LOCAL_ASSETS = {
    "Hermès": {
      cover: ["assets/iconic/hermes/cover-birkin.webp", "Birkin bag"],
      heritage: ["assets/iconic/hermes/heritage-saddle.webp", "French jumping saddle"],
      founder: ["assets/iconic/hermes/founder-saddlers-clamp.webp", "historic saddler's clamp"],
      product: ["assets/iconic/hermes/product-kelly.webp", "Kelly bag"],
      heroshot: ["assets/iconic/hermes/heroshot-carre.webp", "equestrian silk Carré"],
      behind: ["assets/iconic/hermes/behind-orange-leather.webp", "orange leather and saddle stitch"],
      quote: ["assets/iconic/hermes/quote-horse.webp", "equestrian horse"],
      closing: ["assets/iconic/hermes/closing-faubourg.webp", "Faubourg Saint-Honoré flagship"]
    }
  };

  const onReady = callback => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", callback, { once: true });
    else callback();
  };

  function text(value) {
    const node = document.createElement("textarea");
    node.innerHTML = String(value || "").replace(/<br\s*\/?>/gi, " ");
    return node.value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function normalized(value) {
    return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function tokens(value) {
    return normalized(value).split(/\s+/).filter(token => token.length > 2 && !STOP_WORDS.has(token));
  }

  function phraseIn(value, phrase) {
    const target = normalized(phrase);
    return Boolean(target) && ` ${normalized(value)} `.includes(` ${target} `);
  }

  function nearbyOrderedTokens(value, expected, maxGap = 2) {
    const parts = normalized(value).split(/\s+/).filter(Boolean);
    const required = expected.filter(Boolean);
    if (!required.length) return false;
    for (let start = 0; start < parts.length; start += 1) {
      if (parts[start] !== required[0]) continue;
      let cursor = start;
      let matched = true;
      for (let index = 1; index < required.length; index += 1) {
        let next = -1;
        for (let offset = cursor + 1; offset <= Math.min(parts.length - 1, cursor + maxGap); offset += 1) {
          if (parts[offset] === required[index]) { next = offset; break; }
        }
        if (next < 0) { matched = false; break; }
        cursor = next;
      }
      if (matched) return true;
    }
    return false;
  }

  function shortHash(value) {
    let hash = 2166136261;
    for (let i = 0; i < String(value).length; i += 1) {
      hash ^= String(value).charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function profileFor(brand) {
    const category = (typeof CATOF !== "undefined" && CATOF[brand]) || "default";
    const base = CATEGORY_PROFILE[category] || CATEGORY_PROFILE.default;
    const curated = PROFILE_OVERRIDES[brand] || {};
    const info = (typeof INFO !== "undefined" && INFO[brand]) || {};
    const facts = (typeof FACTS !== "undefined" && FACTS[brand]) || [];
    const explicitProduct = curated.primary || info.productName || facts[3];
    const founder = info.founder || facts[1] || "";
    const place = info.place || facts[2] || "";
    return {
      brand,
      category,
      verified: Boolean(curated.primary || info.productName || facts[3]),
      primary: explicitProduct || `${brand} ${base.object}`,
      alternate: curated.alternate || `${brand} ${base.alternate}`,
      material: curated.material || `${brand} ${base.material}`,
      motif: curated.motif || `${brand} ${base.motif}`,
      landmark: curated.landmark || `${brand} ${base.place}${place ? ` ${place}` : ""}`,
      founder,
      place
    };
  }

  function briefsFor(brand) {
    if (BRIEF_CACHE[brand]) return BRIEF_CACHE[brand];
    const p = profileFor(brand);
    const query = (subject, suffix) => {
      const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const withoutDuplicate = String(subject || "").replace(new RegExp(escapedBrand, "ig"), " ");
      const plain = withoutDuplicate.replace(/N°\s*/gi, "No. ").replace(/[^\p{L}\p{N}.&' -]+/gu, " ").replace(/\s+/g, " ").trim();
      return `${brand} ${plain} ${suffix || ""}`.replace(/\s+/g, " ").trim();
    };
    const briefs = {
      cover: { key: "cover", subject: p.primary, query: query(p.primary), kind: "object" },
      heritage: { key: "heritage", subject: p.landmark, query: query(p.landmark), kind: "place" },
      founder: p.founder
        ? { key: "founder", subject: p.founder, query: p.founder, kind: "portrait" }
        : { key: "founder", subject: `${brand} founding workshop`, query: `${brand} founder historic workshop archive`, kind: "archive" },
      product: { key: "product", subject: p.alternate, query: query(p.alternate), kind: "object" },
      heroshot: { key: "heroshot", subject: p.primary, query: query(p.primary), kind: "object" },
      behind: { key: "behind", subject: p.material, query: query(p.material), kind: "material" },
      quote: { key: "quote", subject: p.motif, query: query(p.motif), kind: "motif" },
      closing: { key: "closing", subject: p.landmark, query: query(p.landmark), kind: "place" }
    };
    Object.values(briefs).forEach(brief => { brief.verified = p.verified; });
    BRIEF_CACHE[brand] = briefs;
    return briefs;
  }

  function localAssetsFor(brand) {
    const source = LOCAL_ASSETS[brand];
    if (!source) return null;
    const assets = {};
    CARD_KEYS.forEach(key => {
      const [path, subject] = source[key];
      assets[key] = {
        d: path,
        w: path,
        c: "1%CLUB AI STUDIO",
        s: "GENERATED EDITORIAL",
        id: `local:${brand}:${key}`,
        originalId: `local:${shortHash(path)}`,
        brand,
        slot: key,
        subject,
        sourceUrl: "",
        license: "AI-generated original",
        iconic: true,
        local: true,
        cutoutEligible: key === "cover" || key === "product" || key === "heroshot"
      };
    });
    return assets;
  }

  async function searchCommons(brand, brief) {
    const cacheKey = `${brand}|${brief.query}`;
    if (SEARCH_CACHE.has(cacheKey)) return SEARCH_CACHE.get(cacheKey);
    if (!brief.verified) {
      const empty = Promise.resolve([]);
      SEARCH_CACHE.set(cacheKey, empty);
      return empty;
    }
    const compact = brief.query.replace(QUERY_NOISE, " ").replace(/\s+/g, " ").trim();
    const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const subjectOnly = String(brief.subject || "")
      .replace(new RegExp(escapedBrand, "ig"), " ")
      .replace(QUERY_NOISE, " ")
      .replace(/[^\p{L}\p{N}.&' -]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    const focusWords = subjectOnly.split(/\s+/).filter(word => word.length > 2 && !STOP_WORDS.has(normalized(word)));
    const focus = focusWords[focusWords.length - 1] || "";
    const expanded = [brief.query, compact];
    if (brief.kind === "object") {
      const objectWord = focusWords.find(word => OBJECT_WORDS.has(normalized(word)));
      const namedWords = focusWords.filter(word => !OBJECT_WORDS.has(normalized(word)) && !GENERIC_SUBJECT_WORDS.has(normalized(word)));
      if (objectWord) expanded.push(`${brand} ${objectWord}`);
      if (objectWord && namedWords.length) expanded.push(`${brand} ${objectWord} ${namedWords.join(" ")}`);
    }
    if (brief.kind === "material" && focus) expanded.push(`${brand} ${focus}`);
    if (brief.kind === "motif" && subjectOnly) expanded.push(subjectOnly, focus);
    const variants = [...new Set(expanded.map(value => value.replace(/\s+/g, " ").trim()))].filter(Boolean);
    const request = (async () => {
      const collected = new Map();
      for (const query of variants) {
        const params = new URLSearchParams({
          action: "query",
          generator: "search",
          gsrsearch: query,
          gsrnamespace: "6",
          gsrlimit: "14",
          prop: "imageinfo",
          iiprop: "url|extmetadata|mime|size|sha1",
          iiurlwidth: "1200",
          format: "json",
          formatversion: "2",
          origin: "*"
        });
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 9000);
        try {
          const response = await fetch(`${COMMONS_ENDPOINT}?${params}`, { signal: controller.signal, mode: "cors", credentials: "omit" });
          if (!response.ok) continue;
          const payload = await response.json();
          const pages = (payload.query && payload.query.pages) || [];
          pages.forEach(page => {
            const candidate = candidateFromPage(page, brand, brief);
            if (candidate && !collected.has(candidate.originalId)) collected.set(candidate.originalId, candidate);
          });
          if (collected.size >= 6) break;
        } catch (_) {
          // Try the compact query before falling back to the internal library.
        } finally {
          clearTimeout(timer);
        }
      }
      return [...collected.values()].sort((a, b) => b.score - a.score);
    })();
    SEARCH_CACHE.set(cacheKey, request);
    return request;
  }

  function candidateFromPage(page, brand, brief) {
    const image = page.imageinfo && page.imageinfo[0];
    if (!image || !image.thumburl || !/^image\/(jpeg|png|webp)$/i.test(image.mime || "")) return null;
    if ((image.width || 0) < 640 || (image.height || 0) < 640) return null;
    const meta = image.extmetadata || {};
    const title = text(page.title).replace(/^File:/i, "");
    const description = text((meta.ImageDescription && meta.ImageDescription.value) || (meta.ObjectName && meta.ObjectName.value) || "");
    const titleHaystack = normalized(title);
    const haystack = normalized(`${title} ${description}`);
    if (/\b(logo|wordmark|diagram|map|flag|autograph|poster|brochure|pdf)\b/.test(titleHaystack)) return null;
    const brandTokens = tokens(brand);
    const subjectTokens = tokens(brief.subject);
    const brandSet = new Set(brandTokens);
    const brandNumbers = new Set(normalized(brand).split(/\s+/).filter(token => /^\d+$/.test(token)));
    const subjectNumbers = normalized(brief.subject).split(/\s+/).filter(token => /^\d+$/.test(token) && !brandNumbers.has(token));
    const titleParts = new Set(titleHaystack.split(/\s+/));
    const haystackParts = new Set(haystack.split(/\s+/));
    const subjectNumberHits = subjectNumbers.filter(token => titleParts.has(token)).length;
    const subjectNumberEvidence = subjectNumbers.filter(token => haystackParts.has(token)).length;
    const semanticTokens = subjectTokens.filter(token => !brandSet.has(token) && !GENERIC_SUBJECT_WORDS.has(token));
    const identityTokens = semanticTokens.filter(token => !/^\d+$/.test(token) && !OBJECT_WORDS.has(token) && !PLACE_WORDS.has(token));
    const exactBrand = phraseIn(haystack, brand);
    const exactBrandTitle = phraseIn(titleHaystack, brand);
    const brandHits = brandTokens.filter(token => haystackParts.has(token)).length;
    const brandTitleHits = brandTokens.filter(token => titleParts.has(token)).length;
    const brandThreshold = Math.max(1, Math.ceil(brandTokens.length * 0.67));
    const brandEvidence = exactBrand || brandHits >= brandThreshold;
    const brandTitleEvidence = exactBrandTitle || brandTitleHits >= brandThreshold;
    const subjectHits = semanticTokens.filter(token => haystackParts.has(token)).length;
    const subjectTitleHits = semanticTokens.filter(token => titleParts.has(token)).length;
    const identityHits = identityTokens.filter(token => haystackParts.has(token)).length;
    const identityTitleHits = identityTokens.filter(token => titleParts.has(token)).length;
    const requestedObjects = semanticTokens.filter(token => OBJECT_WORDS.has(token));
    const requestedObjectHits = requestedObjects.filter(token => haystackParts.has(token)).length;
    const requestedObjectTitleHits = requestedObjects.filter(token => titleParts.has(token)).length;
    const placeHits = [...PLACE_WORDS].filter(token => haystackParts.has(token)).length;
    const placeIdentity = identityTokens.filter(token => !NATURE_SYMBOL_WORDS.has(token));
    const placeIdentityHits = placeIdentity.filter(token => haystackParts.has(token)).length;
    const personLike = /\b(portrait|actress|actor|singer|woman|women|man|men|people|person|fashion show|red carpet|photocall|wearing)\b/.test(titleHaystack);

    if (["object", "place"].includes(brief.kind) && subjectNumbers.length && subjectNumberEvidence !== subjectNumbers.length) return null;

    if (brief.kind === "object") {
      const strongIdentity = identityTokens.length > 0 && identityTitleHits >= Math.ceil(identityTokens.length * 0.5);
      if (!brandEvidence && !strongIdentity) return null;
      if (identityTokens.length && !strongIdentity) return null;
      if (!identityTokens.length && requestedObjects.length && requestedObjectHits === 0 && subjectNumbers.length === 0) return null;
      if (!brandTitleEvidence && !strongIdentity && requestedObjectTitleHits === 0 && subjectNumberHits === 0) return null;
      if (personLike && !strongIdentity && requestedObjectTitleHits === 0) return null;
    } else if (brief.kind === "place") {
      if (!brandEvidence) return null;
      if (placeIdentity.length ? placeIdentityHits === 0 : placeHits === 0) return null;
      if (!brandTitleEvidence && placeIdentity.filter(token => titleParts.has(token)).length === 0 && subjectNumberHits === 0) return null;
    } else if (brief.kind === "portrait") {
      const founderTokens = tokens(brief.subject);
      if (!nearbyOrderedTokens(titleHaystack, founderTokens, 2)) return null;
    } else if (brief.kind === "material") {
      if (!brandEvidence || subjectHits === 0) return null;
      if (!brandTitleEvidence && subjectTitleHits === 0) return null;
      if (personLike && subjectTitleHits === 0) return null;
    } else if (brief.kind === "motif") {
      const natureTitleHits = [...NATURE_SYMBOL_WORDS].filter(token => titleParts.has(token) && semanticTokens.includes(token)).length;
      const proprietaryShort = /\b[A-Z]{2,4}\b/.test(String(brief.subject || ""));
      if (subjectHits === 0 || (!brandEvidence && (natureTitleHits === 0 || proprietaryShort))) return null;
      if (!brandTitleEvidence && subjectTitleHits === 0) return null;
    } else if (brief.kind === "archive") {
      if (!brandEvidence || !/\b(founder|founding|archive|workshop|atelier|factory)\b/.test(haystack)) return null;
    }

    let score = exactBrand ? 42 : brandHits * 12;
    score += exactBrandTitle ? 22 : brandTitleHits * 8;
    score += subjectHits * 8;
    score += subjectTitleHits * 15;
    score += identityHits * 12 + identityTitleHits * 18;
    score += subjectNumberEvidence * 9 + subjectNumberHits * 28;
    if (brief.kind === "portrait" && /portrait|founder|founding/.test(haystack)) score += 12;
    if (brief.kind === "place" && /building|store|shop|factory|headquarters|maison|house|hotel|resort|museum|atelier/.test(haystack)) score += 10;
    if (brief.kind === "material" && /detail|craft|making|workshop|leather|wood|metal|glass|textile|fabric/.test(haystack)) score += 8;
    const ratio = (image.width || 1) / (image.height || 1);
    score += Math.max(0, 6 - Math.abs(ratio - 0.8) * 5);
    const artist = text((meta.Artist && meta.Artist.value) || (meta.Credit && meta.Credit.value) || "Wikimedia contributor");
    const license = text((meta.LicenseShortName && meta.LicenseShortName.value) || (meta.UsageTerms && meta.UsageTerms.value) || "See source");
    return {
      id: `commons:${page.pageid}`,
      originalId: `commons:${image.sha1 || page.pageid}`,
      url: image.thumburl,
      sourceUrl: image.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      title,
      artist: artist.slice(0, 72),
      license: license.slice(0, 48),
      width: image.width,
      height: image.height,
      score
    };
  }

  async function loadBitmap(url) {
    const response = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!response.ok) throw new Error(`Image ${response.status}`);
    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = objectURL;
      });
      return image;
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectURL), 0);
    }
  }

  function editorialCanvas(image, width, height, seed) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drift = ((seed % 17) - 8) / 100;
    const x = (width - drawWidth) / 2 + width * drift;
    const y = (height - drawHeight) / 2;
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
    const top = ctx.createLinearGradient(0, 0, 0, height);
    top.addColorStop(0, "rgba(8,7,6,.24)");
    top.addColorStop(0.32, "rgba(8,7,6,0)");
    top.addColorStop(0.72, "rgba(8,7,6,0)");
    top.addColorStop(1, "rgba(8,7,6,.28)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, width, height);
    const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.25, width / 2, height / 2, height * 0.78);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.18)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL("image/webp", 0.86);
  }

  async function prepareCandidate(candidate, brand, key, brief) {
    const image = await loadBitmap(candidate.url);
    const seed = parseInt(shortHash(`${brand}|${key}`), 36) || 1;
    return {
      d: editorialCanvas(image, 960, 1200, seed),
      w: editorialCanvas(image, 1200, 760, seed + 5),
      c: candidate.artist || "WIKIMEDIA CONTRIBUTOR",
      s: "WIKIMEDIA COMMONS",
      id: `${candidate.id}:${key}`,
      originalId: candidate.originalId,
      brand,
      slot: key,
      subject: brief.subject,
      sourceUrl: candidate.sourceUrl,
      license: candidate.license,
      iconic: true,
      remote: true,
      cutoutEligible: key === "cover"
    };
  }

  function fallbackAsset(legacyCatImgFor, brand, key, brief) {
    const source = legacyCatImgFor(brand, key);
    const path = source && (source.d || source.w);
    return {
      ...(source || {}),
      d: path || genBg(brand, key, palFor(brand)),
      w: (source && (source.w || source.d)) || path || genBg(brand, key, palFor(brand)),
      c: (source && source.c) || "1%CLUB VISUAL LIBRARY",
      s: (source && source.s) || "CATEGORY FALLBACK",
      id: `fallback:${brand}:${key}`,
      originalId: `fallback:${shortHash(path || `${brand}|${key}`)}`,
      brand,
      slot: key,
      subject: "대표 오브제 검수 필요",
      requestedSubject: brief.subject,
      sourceUrl: "",
      license: "Fallback visual; replace before publishing",
      iconic: true,
      fallback: true,
      cutoutEligible: false
    };
  }

  async function resolveRemoteBrand(legacyCatImgFor, brand) {
    const briefs = briefsFor(brand);
    const groups = await Promise.all(CARD_KEYS.map(key => searchCommons(brand, briefs[key])));
    const used = new Set();
    const selected = {};
    const compatible = {
      cover: ["heroshot"],
      heritage: ["closing"],
      founder: [],
      product: [],
      heroshot: ["cover"],
      behind: [],
      quote: [],
      closing: ["heritage"]
    };
    const pools = {};
    CARD_KEYS.forEach((key, index) => {
      const own = groups[index] || [];
      const related = compatible[key].flatMap(relatedKey => groups[CARD_KEYS.indexOf(relatedKey)] || []);
      pools[key] = [...new Map([...own, ...related].map(item => [item.originalId, item])).values()];
      const candidate = pools[key].find(item => !used.has(item.originalId));
      if (candidate) {
        used.add(candidate.originalId);
        selected[key] = candidate;
      }
    });
    const assets = {};
    await Promise.all(CARD_KEYS.map(async key => {
      let candidate = selected[key];
      while (candidate) {
        try {
          assets[key] = await prepareCandidate(candidate, brand, key, briefs[key]);
          return;
        } catch (_) {
          used.delete(candidate.originalId);
          candidate = pools[key].find(item => !used.has(item.originalId));
          if (candidate) used.add(candidate.originalId);
        }
      }
      const fallback = fallbackAsset(legacyCatImgFor, brand, key, briefs[key]);
      if (used.has(fallback.originalId)) {
        const generated = genBg(brand, `${key}-unique`, palFor(brand));
        fallback.d = generated;
        fallback.w = generated;
        fallback.originalId = `generated:${brand}:${key}`;
      }
      used.add(fallback.originalId);
      assets[key] = fallback;
    }));
    return assets;
  }

  function statusCounts(assets) {
    const list = Object.values(assets || {});
    return {
      total: list.length,
      local: list.filter(asset => asset.local).length,
      remote: list.filter(asset => asset.remote).length,
      fallback: list.filter(asset => asset.fallback).length
    };
  }

  onReady(function installIconicImagery() {
    if (typeof catImgFor !== "function" || typeof imgWin !== "function" || typeof renderReel !== "function") return;
    const legacyCatImgFor = catImgFor;
    const legacyImgWin = imgWin;
    const legacyRenderSources = renderSources;
    const legacyRenderReel = renderReel;
    const legacySetUploadedImage = setUploadedImage;
    const legacyRenderToCanvas = renderToCanvas;
    const knownBrands = new Set((typeof BRANDS !== "undefined" ? BRANDS : []).map(item => item.n));

    function ensureBrand(brand) {
      if (ASSET_CACHE[brand]) return Promise.resolve(ASSET_CACHE[brand]);
      if (PENDING[brand]) return PENDING[brand];
      const local = localAssetsFor(brand);
      if (local) {
        ASSET_CACHE[brand] = local;
        STATUS[brand] = { state: "ready", ...statusCounts(local) };
        return Promise.resolve(local);
      }
      if (!knownBrands.has(brand)) return Promise.resolve(null);
      STATUS[brand] = { state: "loading", total: 0, local: 0, remote: 0, fallback: 0 };
      updateStatus();
      PENDING[brand] = resolveRemoteBrand(legacyCatImgFor, brand).then(assets => {
        ASSET_CACHE[brand] = assets;
        STATUS[brand] = { state: "ready", ...statusCounts(assets) };
        return assets;
      }).catch(() => {
        const briefs = briefsFor(brand);
        const assets = Object.fromEntries(CARD_KEYS.map(key => [key, fallbackAsset(legacyCatImgFor, brand, key, briefs[key])]));
        ASSET_CACHE[brand] = assets;
        STATUS[brand] = { state: "error", ...statusCounts(assets) };
        return assets;
      }).finally(() => {
        delete PENDING[brand];
        if (state.brand === brand) reRender();
      });
      return PENDING[brand];
    }

    catImgFor = function iconicCatImgFor(brand, cardKey) {
      const local = localAssetsFor(brand);
      if (local && !ASSET_CACHE[brand]) {
        ASSET_CACHE[brand] = local;
        STATUS[brand] = { state: "ready", ...statusCounts(local) };
      }
      if (!ASSET_CACHE[brand] && knownBrands.has(brand)) ensureBrand(brand);
      if (ASSET_CACHE[brand] && ASSET_CACHE[brand][cardKey]) return ASSET_CACHE[brand][cardKey];
      return fallbackAsset(legacyCatImgFor, brand, cardKey, briefsFor(brand)[cardKey]);
    };

    imgWin = function iconicImageWindow(cardKey, palette) {
      if (state.imgs[cardKey]) return legacyImgWin(cardKey, palette);
      const asset = catImgFor(state.brand, cardKey);
      if (!asset || !asset.iconic) return legacyImgWin(cardKey, palette);
      const source = asset.w || asset.d;
      const credit = `PHOTO · ${String(asset.c || "1%CLUB").toUpperCase()} / ${String(asset.s || "EDITORIAL").toUpperCase()}`;
      const flag = asset.fallback ? "CATEGORY STUDY" : "ICONIC OBJECT";
      return `<div class="imgwin iconic-imgwin ${asset.fallback ? "is-fallback" : "is-resolved"} ${asset.local ? "is-local" : ""}">
        <div class="iconic-imgwin__matte"></div>
        <img class="iconic-imgwin__image" src="${escapeHTML(source)}" alt="${escapeHTML(`${state.brand} · ${asset.subject}`)}" crossorigin="anonymous">
        <div class="iconic-imgwin__wash"></div>
        <div class="iconic-imgwin__subject"><span>${flag}</span>${escapeHTML(asset.subject)}</div>
        <div class="photocred2">${escapeHTML(credit)}</div>
      </div>`;
    };

    renderSources = function iconicRenderSources() {
      legacyRenderSources();
      const host = document.getElementById("srcLinks");
      const assets = ASSET_CACHE[state.brand];
      if (!host || !assets) return;
      const sourced = CARD_KEYS.map(key => assets[key]).filter(asset => asset && asset.sourceUrl);
      const unique = [...new Map(sourced.map(asset => [asset.originalId, asset])).values()];
      if (!unique.length) return;
      host.insertAdjacentHTML("beforeend", `<span class="medhead">대표 오브제 원본 (${unique.length})</span>${unique.map(asset => `<span>· <a href="${escapeHTML(asset.sourceUrl)}" target="_blank" rel="noopener">${escapeHTML(asset.slot)} · ${escapeHTML(asset.subject)} ↗</a> <small>${escapeHTML(asset.license)}</small></span>`).join("")}`);
    };

    renderReel = function iconicRenderReel() {
      legacyRenderReel();
      updateStatus();
    };

    setUploadedImage = function iconicSetUploadedImage(cardKey, source) {
      const automatic = CARD_KEYS.filter(key => key !== cardKey).map(key => [key, catImgFor(state.brand, key)]);
      const duplicate = automatic.find(([, asset]) => asset && (asset.d === source || asset.w === source));
      if (duplicate) {
        document.dispatchEvent(new CustomEvent("heritage:image-duplicate", { detail: { cardKey, duplicateKey: duplicate[0] } }));
        return false;
      }
      return legacySetUploadedImage(cardKey, source);
    };

    renderToCanvas = async function iconicRenderToCanvas(cardKey) {
      await ensureBrand(state.brand);
      if (typeof LOGOS !== "undefined" && LOGOS[state.brand] && !CUT[state.brand]) {
        try { await processLogo(state.brand); } catch (_) {}
      }
      if (cardKey === "heroshot" && !state.imgs.heroshot) {
        await new Promise(resolve => {
          let done = false;
          const finish = () => { if (!done) { done = true; resolve(); } };
          const ready = heroImgData(state.brand, palFor(state.brand), finish);
          if (ready) finish();
          setTimeout(finish, 5000);
        });
      }
      const visible = document.getElementById(`card-${cardKey}`);
      if (visible) {
        await Promise.all([...visible.querySelectorAll("img")].map(image => image.complete ? Promise.resolve() : image.decode().catch(() => {})));
      }
      return legacyRenderToCanvas(cardKey);
    };

    function updateStatus() {
      const badge = document.getElementById("factflag");
      if (!badge || !badge.parentElement) return;
      let node = document.getElementById("iconicImageStatus");
      if (!node) {
        node = document.createElement("span");
        node.id = "iconicImageStatus";
        node.className = "iconic-status";
        badge.parentElement.appendChild(node);
      }
      const current = STATUS[state.brand];
      if (!knownBrands.has(state.brand)) {
        node.className = "iconic-status is-fallback";
        node.textContent = "브랜드를 선택하면 대표 오브제 8장을 매칭합니다";
        return;
      }
      if (!current || current.state === "loading") {
        node.className = "iconic-status is-loading";
        node.textContent = "대표 제품 · 소재 · 동물 · 건물 이미지 찾는 중…";
        return;
      }
      if (current.local) {
        node.className = "iconic-status is-ready";
        node.textContent = "대표 오브제 8장 · 전용 매거진 원본";
        return;
      }
      node.className = `iconic-status ${current.fallback ? "is-fallback" : "is-ready"}`;
      node.textContent = `브랜드 원본 ${current.remote}장${current.fallback ? ` · 업종 대체 ${current.fallback}장` : " · 전체 검증"}`;
    }

    findImgUrl = function iconicFindImageUrl(brand, key) {
      const query = briefsFor(brand)[key].query;
      return `https://commons.wikimedia.org/w/index.php?title=Special:MediaSearch&type=image&search=${encodeURIComponent(query)}`;
    };

    window.IconicImagery = Object.freeze({
      keys: [...CARD_KEYS],
      profileFor,
      briefsFor,
      ensureBrand,
      assetsFor: brand => ASSET_CACHE[brand] || null,
      statusFor: brand => STATUS[brand] || null
    });

    ensureBrand(state.brand).then(() => {
      if (state.brand === "Hermès") reRender();
    });
    updateStatus();
  });
})();
