document.addEventListener("DOMContentLoaded", () => {
  // ─────────── Konfiguration & Konstanten ───────────
  const API_BASE_URL = "https://prod-11.germanywestcentral.logic.azure.com:443/workflows/368c72edf01644b185b8930c6c355907/triggers/manual/paths/invoke";
  const API_SIG = "LRVbOzSx5k3G4hoI7lFtyYxFsnCXdkjbVSNTVBViF-g";
  const API_URL = `${API_BASE_URL}?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=${API_SIG}`;

  const SESSION_KEYS = {
    persNr: "personalnummer",
    filNr: "filialnummer",
    expiresAt: "sessionExpiresAt",
    lastTileIndex: "lastSelectedTileIndex"
  };

  const FILIAL_MAP = {
    "1":  "Homberg",
    "0":  "Melsungen",
    "2":  "Melsungen",
    "3": "Jack & Jones",
    "4": "Fritzlar",
    "6": "Kassel",
    "9": "Arnsberg",
    "10": "Kassel",
    "11": "Kassel",
    "15": "Nordhausen",
    "16": "Hann. Münden",
    "18": "Eschwege",
    "20": "Eschwege",
    "22": "Homberg",
    "23": "Nordhausen",
    "24": "Goslar",
    "25": "Goslar",
    "27": "Soest",
    "29": "Bad Hersfeld",
    "40": "Bad Hersfeld",
    "43": "Bad Hersfeld",
    "47": "Bad Hersfeld",
    "51": "Bad Hersfeld",
    "52": "Bad Hersfeld",
    "55": "Bad Hersfeld",
    "30": "Kassel",
    "36": "Einbeck",
    "46": "Homberg",
    "49": "Schwalmstadt",
    "50": "Melsungen",
    "53": "Einbeck",
    "54": "Eschwege",
    "56": "Homberg",
    "57": "Eschwege",
  };

  const ZALANDO_REASONS = [
    "Artikel vorhanden",
    "Artikel defekt",
    "Kein Bestand",
    "Nicht Auffindbar",
    "Ware nicht vollständig",
    "Bereits gepicked für andere Bestellung / bereits stationär verkauft",
    "Umlagerung",
    "Hersteller Retoure",
    "Anderer Grund"
  ];

  // ─────────── State-Variablen ───────────
  let hasSent = false;
  let currentTileName = "";
  let selectedTileIndex = 0;
  let twoEans = false;
  let passReason = "";

  // ─────────── DOM-Referenzen ───────────
  const tiles          = Array.from(document.querySelectorAll(".tile.clickable"));
  const popup          = document.getElementById("customPopup");
  const userFieldsWrapper = document.getElementById("user-fields-wrapper");
  const mainContainer  = document.getElementById("main");
  const navFilialPlaceholder = document.getElementById("filialnamePlaceholder");

  const containers = {
    tile:      document.getElementById("tileContainer"),
    gutschein: document.getElementById("gutscheinContainer"),
    best1:     document.getElementById("containerBestellungNichtErfuellbar"),
    step2:     document.getElementById("containerBestellungStep2"),
    opt1:      document.getElementById("containerBestellungOpt1"),
    opt2:      document.getElementById("containerBestellungOpt2"),
    pass1:     document.getElementById("containerPasswortResetStep1"),
    pass2:     document.getElementById("containerPasswortResetStep2"),
    sonstiges: document.getElementById("containerSonstiges")
  };

  const inputs = {
    persNr:        document.getElementById("personalnummer"),
    filNr:         document.getElementById("filialnummer"),
    gutschein:     document.getElementById("gutscheinInput"),
    gutscheinWert: document.getElementById("gutscheinWertInput"),
    best1:         document.getElementById("input1"),
    ean1:          document.getElementById("step2Input1"),
    ean2:          document.getElementById("step2Input2"),
    newPassword:   document.getElementById("newPasswordInput"),
    sonstiges:     document.getElementById("sonstigesInput")
  };

  const buttons = {
    popupYes:      document.getElementById("popupYes"),
    popupNo:       document.getElementById("popupNo"),
    save:          document.getElementById("saveBtn"),
    passPrev:      document.getElementById("passwordPrev"),
    passConfirm:   document.getElementById("passwordConfirm"),
    sonstPrev:     document.getElementById("sonstigesPrev"),
    sonstConfirm:  document.getElementById("sonstigesConfirm"),
    backStep2:     document.getElementById("backBtn"),
    addSecondEAN:  document.getElementById("addSecondEANBox"),
    confirmReason: document.getElementById("confirmReasonBtn"),
    confirmReason2:document.getElementById("confirmReasonBtn2")
  };

  const arrowPrev     = document.getElementById("arrowPrev");
  const arrowNext     = document.getElementById("arrowNext");
  const zalandoNext   = document.getElementById("nextArrow");
  const step2Confirm  = document.getElementById("step2Confirm");
  const infoText      = document.getElementById("infoText");

  const reasonGrid1   = document.getElementById("reasonGrid1");
  const reasonGrid2   = document.getElementById("reasonGrid2");
  const containerOpt2 = document.getElementById("containerBestellungOpt2");
  const opt2Headline  = containerOpt2.querySelector("h2");
  const box1          = document.getElementById("kachelEAN1");
  const box2          = document.getElementById("kachelEAN2");
  const confirmBtn    = document.getElementById("step2Confirm");

  
// Beispiel für deine Inputs:
setupBlinkingPlaceholder(inputs.gutschein);
setupBlinkingPlaceholder(inputs.gutscheinWert);
setupBlinkingPlaceholder(inputs.best1);
setupBlinkingPlaceholder(inputs.ean1);
setupBlinkingPlaceholder(inputs.ean2);
setupBlinkingPlaceholder(inputs.newPassword);
setupBlinkingPlaceholder(inputs.sonstiges);



  // ─────────── Session-Handling ───────────
  function expireSession() {
    [SESSION_KEYS.persNr, SESSION_KEYS.filNr, SESSION_KEYS.expiresAt].forEach(k => localStorage.removeItem(k));
    disableAllTiles();
    alert("Deine Session ist abgelaufen. Bitte Personal- und Filialnummer erneut eingeben.");
  }

  (function initSessionTimer() {
    const now = new Date();
    const exp = localStorage.getItem(SESSION_KEYS.expiresAt);
    if (!exp) return;

    const expiresAt = new Date(exp);
    if (expiresAt > now) {
      setTimeout(expireSession, expiresAt - now);
    } else {
      expireSession();
    }
  })();

  // ─────────── UI Utility-Funktionen ───────────
  /**
 * Versteckt **nur** die eigentlichen Content‐Container (tile, best1, opt1, opt2, pass1, pass2, gutschein, sonstiges).
 * Es bleibt aber immer das userFieldsWrapper übrig, damit Personal-/Filialnummer oben in der Tile‐Ansicht bleibt.
 */
function hideAllViews() {
  // Verstecke jeden Container in deinem containers‐Objekt
  Object.values(containers).forEach(c => {
    if (c) c.style.display = "none";
  });
  // userFieldsWrapper bleibt unberührt; wir zeigen/​verstecken es in showView()
}

function updateTileSelection() {
  tiles.forEach((tileEl, idx) => {
    if (idx === selectedTileIndex) {
      tileEl.classList.add("keyboard-selected");
      tileEl.scrollIntoView({ behavior: "smooth", block: "center" });
      tileEl.focus();
    } else {
      tileEl.classList.remove("keyboard-selected");
      // kein Inline-Transform mehr nötig, CSS-Regel übernimmt alles
    }
  });
  localStorage.setItem(SESSION_KEYS.lastTileIndex, selectedTileIndex);
}


/**
 * Zeigt genau einen der container‐Views an und blendet userFieldsWrapper
 * nur dann ein, wenn name === "tile". Zusätzlich setzen wir in der Tile‐Ansicht
 * den Fokus automatisch auf das erste leere Eingabefeld (PersNr/FilNr).
 *
 * @param {string} name  – einer der Keys in containers (z.B. "tile", "best1", "opt1", "pass1", "gutschein", "sonstiges" etc.)
 */
function showView(name) {
  hideAllViews();

  if (containers[name]) containers[name].style.display = "flex";

  if (name === "tile") {
    if (userFieldsWrapper) userFieldsWrapper.style.display = "flex";

    // Fokus auf erstes freies Eingabefeld
    if (!inputs.persNr.value.trim()) {
      inputs.persNr.focus();
    } else if (!inputs.filNr.value.trim()) {
      inputs.filNr.focus();
    } else {
      updateTileSelection();
    }
  } else {
    if (userFieldsWrapper) userFieldsWrapper.style.display = "none";
  }
}


  function focusDelayed(el) {
    setTimeout(() => el && el.focus(), 50);
  }
  function disableAllTiles() {
    tiles.forEach(t => {
      t.classList.add("disabled");
      t.tabIndex = -1;
    });
  }
  function enableAllTiles() {
    tiles.forEach(t => {
      if (t.dataset.kachelname !== "Coming Soon") {
        t.classList.remove("disabled");
        t.tabIndex = 0;
      }
    });
  }
  function updateFilialPlaceholder() {
    const nr = inputs.filNr.value.trim();
    const name = FILIAL_MAP[nr] || "unbekannt";
    navFilialPlaceholder.textContent = `Standort ${name}`;
  }

  // ─────────── Keyboard-Navigation: Tile-Auswahl ───────────
/**
 * Hebt die aktuell ausgewählte Kachel (selectedTileIndex) hervor,
 * scrollt sie ins Zentrum und fokussiert sie per Tastaturfokus.
 */


 function moveTileSelection(direction) {
  let next = selectedTileIndex;
  do {
    next = (next + direction + tiles.length) % tiles.length;
  } while (
    tiles[next].dataset.kachelname === "Coming Soon" ||
    tiles[next].classList.contains("disabled") &&
    next !== selectedTileIndex
  );
  selectedTileIndex = next;
  updateTileSelection();
}


  document.addEventListener("keydown", e => {
    // Wenn Popup angezeigt, nur zwischen Popup-Buttons navigieren
    if (getComputedStyle(popup).display === "flex") {
      const popupBtns = [buttons.popupYes, buttons.popupNo];
      if (/Arrow(Right|Left)/.test(e.key)) {
        let idx = popupBtns.findIndex(b => b.classList.contains("keyboard-selected"));
        idx = (idx + (e.key === "ArrowRight" ? 1 : -1) + popupBtns.length) % popupBtns.length;
        popupBtns.forEach((b, i) => b.classList.toggle("keyboard-selected", i === idx));
        popupBtns[idx].focus();
        e.preventDefault();
      } else if (e.key === "Enter") {
        popupBtns.find(b => b.classList.contains("keyboard-selected")).click();
      }
      return;
    }

    // Wenn wir auf der Tile-Übersicht sind und Save-Button deaktiviert ist: keine Navigation
    if (
      getComputedStyle(containers.tile).display === "flex" &&
      buttons.save.disabled &&
      (/Arrow(Right|Left)/.test(e.key) || e.key === "Enter")
    ) {
      return;
    }

    // Normale Tile-Navigation
    if (getComputedStyle(containers.tile).display !== "none") {
      if (/Arrow(Right|Left)/.test(e.key)) {
        moveTileSelection(e.key === "ArrowRight" ? 1 : -1);
        e.preventDefault();
      } else if (e.key === "Enter" && !tiles[selectedTileIndex].classList.contains("disabled")) {
        tiles[selectedTileIndex].click();
      }
    }
  });

  // ─────────── Input-Validierung für Personal- & Filialnummer ───────────
  function validatePersonalFilial() {
    const bothFilled = inputs.persNr.value.trim() && inputs.filNr.value.trim();
    buttons.save.disabled = !bothFilled;
  }
  [inputs.persNr, inputs.filNr].forEach(inp => {
    inp.addEventListener("input", e => {
      // Nur Ziffern erlauben
      e.target.value = e.target.value.replace(/\D/g, "");
      validatePersonalFilial();
      if (!inputs.persNr.value.trim() || !inputs.filNr.value.trim()) {
        disableAllTiles();
      }
    });
  });


  
  // Auf Enter in PersNr → Fokus auf FilNr
  inputs.persNr.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputs.filNr.focus();
    }
  });
  // Auf Enter in FilNr → Klick auf Speichern (falls möglich)
  inputs.filNr.addEventListener("keydown", e => {
    if (e.key === "Enter" && !buttons.save.disabled) {
      e.preventDefault();
      e.stopPropagation();
      buttons.save.click();
    }
  });


  
  // ─────────── „Zurück“-Funktion in allen Flows ───────────
  function goBackToTiles() {
    showView("tile");
  }
  arrowPrev.addEventListener("click", goBackToTiles);
  buttons.passPrev.addEventListener("click", goBackToTiles);
  buttons.sonstPrev.addEventListener("click", goBackToTiles);
  buttons.backStep2.addEventListener("click", () => {
    // Zurück zum ersten Zalando-Input
    hideAllViews();
    showView("best1");
    resetZalandoStep2();
  });

// ─── 1) updateTile-Funktion ───
/**
 * Hebt die aktuell ausgewählte Kachel (selectedTile) hervor,
 * scrollt sie ggf. ins Zentrum und fokussiert sie per Keyboard-Focus.
 */
function updateTile() {
  // Alle Kacheln durchlaufen: nur die mit index === selectedTile bekommt .keyboard-selected
  tiles.forEach((t, i) => {
    if (i === selectedTile) {
      t.classList.add("keyboard-selected");
      // Scrolle die Kachel ins Zentrum des Viewports
      t.scrollIntoView({ behavior: "smooth", block: "center" });
      // Setze den Tastatur-Fokus
      t.focus();
    } else {
      t.classList.remove("keyboard-selected");
      // Optional: transform zurücksetzen, falls per CSS Hover/Focus verändert
      t.style.transform = "";
    }
  });
  // Speichere die Auswahl in localStorage (falls ihr das noch verwendet)
  localStorage.setItem("lastSelectedTileIndex", selectedTile);
}


function setupBlinkingPlaceholder(input) {
  input.addEventListener("focus", () => {
    if (input.value.trim() === "") {
      input.classList.add("blink-placeholder");
      input.placeholder = "Warte auf Eingabe...";
    }
  });

  input.addEventListener("input", () => {
    if (input.value.trim() !== "") {
      input.classList.remove("blink-placeholder");
      input.placeholder = "";
    } else {
      input.classList.add("blink-placeholder");
      input.placeholder = "Warte auf Eingabe...";
    }
  });

  input.addEventListener("blur", () => {
    // Wenn leer → sofort wieder Fokus setzen
    if (input.value.trim() === "") {
      setTimeout(() => input.focus(), 10);
    } else {
      input.classList.remove("blink-placeholder");
      input.placeholder = "";
    }
  });
}


// Wende es direkt auf deine Inputs an:
Object.values(inputs).forEach(setupBlinkingPlaceholder);



  // ─────────── Tile-Auswahl & Mounting User-Fields (falls nötig) ───────────
/**
 * Wird aufgerufen, wenn eine Kachel (Tile) angeklickt wird.
 * Zeigt die jeweilige View an und blendet die Nutzerleiste (userFieldsWrapper)
 * nur in der Tile-Ansicht ein.
 *
 * @param {number} i      – Index der Kachel in tiles[]
 * @param {string} name   – dataset.kachelname (z.B. "Zalando Bestellung nicht erfüllbar")
 */
function selectTile(i, name) {
  // 1) Nutzerleiste (Personal-/Filialnummer) kurz ausblenden,
  //    bevor wir eine andere View anzeigen
  if (userFieldsWrapper) {
    userFieldsWrapper.style.display = "none";
  }

  // 2) Setze die neue Auswahl
  selectedTileIndex = i;
  currentTileName = name;

  // 3) Optische Hervorhebung der Kachel
  updateTileSelection();

  // 4) Alle Container unsichtbar machen
  hideAllViews();

  // 5) Je nach Kachelnamen die richtige View anzeigen
  switch (name) {
    case "Online Gutscheine":
      showView("gutschein");
      resetGutscheinForm();
      focusDelayed(inputs.gutschein); // Fokus aufs Gutschein-Feld
      break;

    case "Zalando Bestellung nicht erfüllbar":
      // → Komplett zurücksetzen, bevor wir das Best1-Formular öffnen
      resetZalandoFlowCompletely();
      showView("best1");
      focusDelayed(inputs.best1); // Fokus auf Order-ID
      break;

    case "Zalando Passwort zurücksetzen":
      showView("pass1");
      focusFirstPasswortReason(); 
      break;

    case "Sonstiges Anliegen":
      showView("sonstiges");
      focusDelayed(inputs.sonstiges); // Fokus aufs Sonstiges-Feld
      break;

    default:
      // Fallback: Zurück zur Kachel-Übersicht
      showView("tile");
      // updateTileSelection() wurde oben bereits aufgerufen
      break;
  }
}

tiles.forEach((t, i) => {
  t.tabIndex = 0;

  // Klick per Maus: über selectTile wird 'keyboard-selected' gesetzt
  t.addEventListener("click", e => {
    if (t.classList.contains("disabled")) {
      e.stopPropagation();
      return;
    }
    selectTile(i, t.dataset.kachelname);
  });
});




  // ─────────── Gutschein-Flow ───────────
  function resetGutscheinForm() {
    inputs.gutschein.value = "";
    inputs.gutscheinWert.value = "";
    document.getElementById("kachelCode").style.borderColor = "";
    document.getElementById("kachelWert").style.borderColor = "";
    arrowNext.style.color = "white";
  }

  function updateGutscheinUI() {
      const codeOk = inputs.gutschein.value.trim();
      const wertOk = inputs.gutscheinWert.value.trim();
      document.getElementById("kachelCode").style.borderColor = codeOk ? "green" : "";
      document.getElementById("kachelWert").style.borderColor = wertOk ? "green" : "";
      arrowNext.style.color = codeOk && wertOk ? "green" : "white";
  }



  inputs.gutschein.addEventListener("input", updateGutscheinUI);
  inputs.gutscheinWert.addEventListener("input", updateGutscheinUI);

  inputs.gutschein.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusDelayed(inputs.gutscheinWert);
    }
  });
  inputs.gutscheinWert.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      arrowNext.click();
    }
  });

  arrowNext.addEventListener("click", async e => {
    e.preventDefault();
    const code = inputs.gutschein.value.trim();
    const wert = inputs.gutscheinWert.value.trim();
    if (!code || !wert || hasSent) return;

    hasSent = true;
    const payload = {
      kachelname:     "Online Gutscheine",
      gutscheincode:  code,
      gutscheinwert:  wert,
      personalnummer: inputs.persNr.value.trim(),
      filialnummer:   inputs.filNr.value.trim()
    };

    try {
      const res = await fetch(API_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload)
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Status ${res.status}: ${text}`);
      resetGutscheinForm();
      showView("tile");
    } catch (err) {
      console.error("Fehler beim Senden des Gutscheins:", err);
      alert("Netzwerkfehler beim Senden des Gutscheins:\n" + err.message);
      showView("gutschein");
    } finally {
      hasSent = false;
    }
  });

  // Popup-Yes/No (für Gutschein und Passwort-Reset)
  buttons.popupYes.addEventListener("click", async () => {
    if (hasSent) return;
    hasSent = true;
    hideAllViews();

    try {
      // Beispiel: „Ja, wirklich senden“ – hier wäre der Logik-Call for Gutschein oder Passwort
      // Wir lassen in diesem Code bloß den Erfolg-Pfad
      showView("tile");
    } catch (err) {
      console.error(err);
      alert("Beim Senden ist ein Fehler aufgetreten: " + err.message);
      showView("tile");
    } finally {
      hasSent = false;
    }
  });
  buttons.popupNo.addEventListener("click", () => {
    hideAllViews();
    showView("gutschein");
    focusDelayed(inputs.gutscheinWert);
  });

  // Hilfsfunktion zum Versenden der Gutschein-Anfrage (wird oben integriert)
  async function sendGutschein() {
    const payload = {
      kachelname:     currentTileName,
      gutscheincode:  inputs.gutschein.value.trim(),
      gutscheinwert:  inputs.gutscheinWert.value.trim(),
      personalnummer: inputs.persNr.value.trim(),
      filialnummer:   inputs.filNr.value.trim()
    };
    try {
      const res = await fetch(API_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload)
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Status ${res.status}: ${text}`);
      showView("tile");
    } catch (err) {
      console.error("Gutschein-Fehler:", err);
      alert("Netzwerkfehler beim Senden des Gutscheins:\n" + err.message);
      showView("gutschein");
    } finally {
      hasSent = false;
    }
  }

  // ─────────── Zalando „Nicht erfüllbar“-Flow ───────────
  function resetZalandoStep2() {
    inputs.ean1.value = "";
    inputs.ean2.value = "";
    box1.style.borderColor = "black";
    box2.style.borderColor = "black";
    box2.style.display = "none";
    confirmBtn.style.color = "white";
    twoEans = false;
  }

  zalandoNext.addEventListener("click", () => {
    if (!inputs.best1.value.trim()) return;
    box1.style.borderColor = "green";
    showView("step2");
    focusDelayed(inputs.ean1);
  });
  inputs.best1.addEventListener("input", () => {
    const ok = inputs.best1.value.trim();
    document.getElementById("box1").style.borderColor = ok ? "green" : "black";
    zalandoNext.style.color = ok ? "green" : "white";
  });
  inputs.best1.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      zalandoNext.click();
    }
  });

  // Multi-EAN-Logik für Schritt 2
  function updateConfirmState() {
    const val1 = inputs.ean1.value.trim();
    const val2 = inputs.ean2.value.trim();
    const valid1 = val1 !== "";
    const valid2 = twoEans ? val2 !== "" : true;
    box1.style.borderColor = valid1 ? "green" : "black";
    if (twoEans) {
      box2.style.borderColor = val2 !== "" ? "green" : "black";
    }
    confirmBtn.style.color = valid1 && valid2 ? "green" : "white";
  }

  inputs.ean1.addEventListener("input", updateConfirmState);
  inputs.ean2.addEventListener("input", updateConfirmState);

  inputs.ean1.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (box2.style.display === "flex") {
        inputs.ean2.focus();
      } else if (confirmBtn.style.color === "green") {
        confirmBtn.click();
      }
    }
  });
  inputs.ean2.addEventListener("keydown", e => {
    if (e.key === "Enter" && confirmBtn.style.color === "green") {
      e.preventDefault();
      confirmBtn.click();
    }
  });

  buttons.addSecondEAN.addEventListener("click", () => {
    box2.style.display = "flex";
    buttons.addSecondEAN.style.display = "none";
    inputs.ean2.focus();
    twoEans = true;
    updateConfirmState();
  });

  confirmBtn.addEventListener("click", () => {
    const val1 = inputs.ean1.value.trim();
    const val2 = inputs.ean2.value.trim();
    if (!val1 || (twoEans && !val2)) return;

    const eans = [val1];
    if (twoEans && val2) eans.push(val2);

    // Reset Inputs
    resetZalandoStep2();
    hideAllViews();

    if (eans.length === 1) {
      showView("opt1");
      buildReasonGrid1(reasonGrid1, ZALANDO_REASONS, eans);
    } else {
      showView("opt2");
      buildReasonGrid2(reasonGrid2, ZALANDO_REASONS, eans);
    }
  });

/**
 * Setzt **komplett** alle Eingaben, Boxen und Flags im Zalando-Flow (Ein- & Zwei-EAN) zurück.
 * Wird immer aufgerufen, wenn man **neu** in die „Zalando Bestellung nicht erfüllbar“-Kachel kommt
 * oder direkt **nach** dem Abschicken (Confirm).
 */
function resetZalandoFlowCompletely() {
  // 1) Zurücksetzen der Order-ID und Next-Pfeil
  inputs.best1.value = "";
  document.getElementById("box1").style.borderColor = "black";
  zalandoNext.style.color = "white";

  // 2) Zurücksetzen der EAN-Felder und Boxen
  inputs.ean1.value = "";
  inputs.ean2.value = "";
  box1.style.borderColor = "black";
  box2.style.borderColor = "black";
  box2.style.display = "none";

  // 3) Zurücksetzen des Confirm-Buttons im Step-2
  confirmBtn.style.color = "white";

  // 4) Flag für Zwei-EAN auf false
  twoEans = false;

  // 5) Leere beide Reason-Grids (falls dort Buttons stehen geblieben sind)
  reasonGrid1.innerHTML = "";
  reasonGrid2.innerHTML = "";

  // 6) Zurücksetzen der beiden Confirm-Buttons in den Reason-Grids
  buttons.confirmReason.disabled = true;
  buttons.confirmReason.style.color = "white";
  buttons.confirmReason.style.cursor = "not-allowed";

  buttons.confirmReason2.disabled = true;
  buttons.confirmReason2.style.color = "white";
  buttons.confirmReason2.style.cursor = "not-allowed";

  // 7) Doppelte EAN-Option wieder einblenden
  buttons.addSecondEAN.style.display = "flex";
}


/**
 * buildReasonGrid1 baut das Grid für den Ein‐EAN‐Fall:
 *  • Pfeil-Rechts / Pfeil-Links navigiert zwischen den Grund-Buttons.
 *  • Enter auf einem Grund ordnet die einzige EAN (eans[0]) diesem Grund zu.
 *  • Sobald ein Grund vergeben ist: zeigt ein "×" und fokussiert den grünen Confirm-Pfeil.
 *  • Klick oder Enter auf den Confirm-Pfeil sendet das Ticket, ruft resetZalandoFlowCompletely() auf
 *    und springt direkt zur Tile-Übersicht (focus auf die aktuell selektierte Kachel).
 *
 * @param {HTMLElement} grid     – Container für die Grund-Buttons (z. B. reasonGrid1).
 * @param {string[]}   reasons  – Array mit allen möglichen Gründen.
 * @param {string[]}   eans     – Array mit genau 1 EAN‐String, z. B. ["5273849201"].
 */
function buildReasonGrid1(grid, reasons, eans) {
  // Lokaler State: ean → grund. Anfangs leer.
  const assignments = {};

  // Hilfsfunktion: true, sobald eans[0] schon einen Grund hat.
  function isAssigned() {
    return assignments.hasOwnProperty(eans[0]);
  }

  /**
   * Aktualisiert die Buttons:
   *  - färbt den vergebenen Grund-Button grün (.selected),
   *  - zeigt ein "×" und eine .ean-tags-Box mit dem EAN,
   *  - aktiviert und fokussiert den Confirm-Button, sobald isAssigned()==true.
   */
  function updateUI() {
    // 1) Alle Buttons zuerst auf neutral zurücksetzen.
    Array.from(grid.children).forEach(btn => {
      btn.classList.remove("selected", "keyboard-selected");
      btn.querySelector(".ean-tags")?.remove();
      btn.querySelector(".remove-tag")?.remove();
    });

    // 2) Falls schon vergeben, zeige die Markierung
    if (isAssigned()) {
      const currentEAN = eans[0];
      const currentReason = assignments[currentEAN];
      const btn = Array.from(grid.children)
        .find(b => b.textContent.trim() === currentReason);
      if (btn) {
        btn.classList.add("selected");
        // a) EAN‐Tag:
        const tagBox = document.createElement("div");
        tagBox.className = "ean-tags";
        tagBox.style.cssText = `
          margin-top: 4px;
          font-size: 12px;
          color: white;
          background-color: rgba(0, 150, 0, 0.7);
          border-radius: 4px;
          padding: 2px 4px;
          text-align: center;
        `;
        tagBox.innerHTML = `<div>${currentEAN}</div>`;
        btn.appendChild(tagBox);
        // b) "×"-Icon:
        const removeBtn = document.createElement("span");
        removeBtn.className = "remove-tag";
        removeBtn.innerHTML = "&times;";
        removeBtn.style.cssText = `
          position: absolute;
          top: 4px;
          right: 6px;
          color: white;
          cursor: pointer;
          user-select: none;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        `;
        removeBtn.addEventListener("click", e => {
          e.stopPropagation();
          delete assignments[currentEAN];
          updateUI();
        });
        btn.appendChild(removeBtn);
      }
    }

    // 3) Confirm-Button erst aktiv (grün) machen, wenn isAssigned()==true
    if (isAssigned()) {
      buttons.confirmReason.disabled = false;
      buttons.confirmReason.style.color = "#4caf50";
      buttons.confirmReason.style.cursor = "pointer";
      // Fokus sofort auf Confirm-Button, damit ein weiterer Enter sicher abschickt
      buttons.confirmReason.focus();
    } else {
      buttons.confirmReason.disabled = true;
      buttons.confirmReason.style.color = "white";
      buttons.confirmReason.style.cursor = "not-allowed";
    }
  }

  // 0) Grid vorab leeren, Confirm zurücksetzen
  grid.innerHTML = "";
  buttons.confirmReason.disabled = true;
  buttons.confirmReason.style.color = "white";
  buttons.confirmReason.style.cursor = "not-allowed";

  // 1) Erzeuge für jeden Grund einen Button
  reasons.forEach(grund => {
    const btn = document.createElement("button");
    btn.textContent = grund;
    btn.tabIndex = 0;
    btn.style.cssText = `
      padding: 10px;
      font-size: 14px;
      border: 2px solid black;
      border-radius: 6px;
      background: #eee;
      cursor: pointer;
      outline: none;
      position: relative;
      min-height: 60px;
      transition: transform 0.1s ease, border-color 0.1s ease, box-shadow 0.1s ease;
    `;

    // Tastatur-Fokus-Styling
    btn.addEventListener("focus", () => btn.classList.add("keyboard-selected"));
    btn.addEventListener("blur", () => btn.classList.remove("keyboard-selected"));

    // Klick (Maus) auf den Button
    btn.addEventListener("click", () => {
      const currentEAN = eans[0];
      if (!isAssigned()) {
        // Erstzuweisung
        assignments[currentEAN] = grund;
        updateUI();
      }
      // Wenn bereits vergeben, ignorieren – Löschen nur per "×"
    });

    // Tastatur-Logik: Pfeile + Enter
    btn.addEventListener("keydown", e => {
      const btns = Array.from(grid.querySelectorAll("button"));
      const index = btns.indexOf(btn);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        btns[(index + 1) % btns.length].focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        btns[(index - 1 + btns.length) % btns.length].focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!isAssigned()) {
          btn.click();
          // updateUI() fängt den Fokus auf Confirm ab
        }
      }
    });

    grid.appendChild(btn);
  });

   // … direkt nach dem Erzeugen aller Reason-Buttons …

 // ─── Innerhalb von buildReasonGrid1(…) ───
// … vorher kommt der Code, der alle Buttons rendert …

// 2) Confirm-Button: Klick oder Enter → Ticket versenden + Reset + Tile-Ansicht
buttons.confirmReason.onclick = () => {
  if (!assignments.hasOwnProperty(eans[0])) return;

  // a) Ticket senden
  sendZalandoTicket({
    kachelname: currentTileName,
    orderId:    inputs.best1.value.trim(),
    eans:       [eans[0]],
    reason:     assignments[eans[0]]
  });

  // b) Komplettes Zurücksetzen
  resetZalandoFlowCompletely();
  Object.keys(assignments).forEach(key => delete assignments[key]);

  // c) Unmittelbar zurück zur Tile-Übersicht
  hideAllViews();
  showView("tile");
};

// ← Änderung hier: Keydown auf Confirm-Button muss propagation stoppen
buttons.confirmReason.addEventListener("keydown", e => {
  if (e.key === "Enter" && !buttons.confirmReason.disabled) {
    e.preventDefault();
    e.stopImmediatePropagation();  // verhindert, dass der globale Keydown weiterspringt
    buttons.confirmReason.click();
  }
});


  // Auf Enter in Confirm genauso reagieren
  buttons.confirmReason.addEventListener("keydown", e => {
    if (e.key === "Enter" && !buttons.confirmReason.disabled) {
      e.preventDefault();
      buttons.confirmReason.click();
    }
  });


  // 3) Fokus initial auf den ersten Button
  setTimeout(() => {
    const firstBtn = grid.querySelector("button");
    if (firstBtn) firstBtn.focus();
  }, 50);
}


/**
 * buildReasonGrid2 baut das Grid für den Zwei-EAN-Fall:
 *  • Pfeil-Rechts / Pfeil-Links: Navigation zwischen den Grund-Buttons.
 *  • Enter auf einem Grund ordnet diesem Grund jeweils eine freie EAN (erst EAN1, dann EAN2) zu.
 *  • In jeder vergebenen Kachel erscheint oben rechts ein "×", um alle EAN-Zuweisungen dieses Grunds zu löschen.
 *  • Sobald 2 EANs vergeben sind, wird der Confirm-Pfeil grün und fokussiert.
 *  • Klick oder Enter auf Confirm sendet je ein Ticket pro EAN, ruft resetZalandoFlowCompletely() auf
 *    und wechselt direkt zur Tile-Übersicht (mit Fokus auf die selektierte Kachel).
 *
 * @param {HTMLElement} grid     – Container für die Grund-Buttons (z. B. reasonGrid2).
 * @param {string[]}   reasons  – Array aller möglichen Gründe.
 * @param {string[]}   eans     – Array mit genau 2 EAN-Strings, z. B. ["EAN123","EAN456"].
 */
function buildReasonGrid2(grid, reasons, eans) {
  // Lokaler State: { ean: grund }. Anfangs leer.
  const assignments = {};

  // Hilfsfunktionen
  function totalAssigned() {
    return Object.keys(assignments).length;
  }
  function nextFreeEAN() {
    return eans.find(ean => !(ean in assignments));
  }

  /**
   * Aktualisiert das Grid:
   *  - färbt Buttons grün, die ≥1 EANs haben (.selected),
   *  - zeigt unter dem Button eine .ean-tags-Box mit EAN(s),
   *  - blendet "×" ein, um alle EANs eines Grunds zu löschen,
   *  - aktiviert (grün) + fokussiert den Confirm-Pfeil, wenn totalAssigned()===2.
   */
  function updateUI() {
    // 1) Gruppiere assignments nach Grund: reason → [EANs]
    const usagePerReason = {};
    Object.entries(assignments).forEach(([ean, grund]) => {
      if (!usagePerReason[grund]) usagePerReason[grund] = [];
      usagePerReason[grund].push(ean);
    });

    // 2) Alle Buttons resetten
    Array.from(grid.children).forEach(btn => {
      btn.classList.remove("selected", "keyboard-selected");
      btn.querySelector(".ean-tags")?.remove();
      btn.querySelector(".remove-tag")?.remove();
    });

    // 3) Für jeden Grund, der ≥1 EANs hat, rendere:
    Object.entries(usagePerReason).forEach(([grund, zugewieseneEANs]) => {
      const btn = Array.from(grid.children).find(b => b.textContent.trim() === grund);
      if (!btn) return;

      // a) Grün markieren
      btn.classList.add("selected");

      // b) EAN-Tags (1 oder 2 Zeilen)
      const tagBox = document.createElement("div");
      tagBox.className = "ean-tags";
      tagBox.style.cssText = `
        margin-top: 4px;
        font-size: 12px;
        color: white;
        background-color: rgba(0, 150, 0, 0.7);
        border-radius: 4px;
        padding: 2px 4px;
        text-align: center;
      `;
      tagBox.innerHTML = zugewieseneEANs.map(ean => `<div>${ean}</div>`).join("");
      btn.appendChild(tagBox);

      // c) "×" oben rechts zum Löschen
      const removeBtn = document.createElement("span");
      removeBtn.className = "remove-tag";
      removeBtn.innerHTML = "&times;";
      removeBtn.style.cssText = `
        position: absolute;
        top: 4px;
        right: 6px;
        font-size: 1rem;
        color: white;
        cursor: pointer;
        user-select: none;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      `;
      removeBtn.addEventListener("click", e => {
        e.stopPropagation();
        // Lösche alle EANs diesen Grunds
        Object.keys(assignments).forEach(eanKey => {
          if (assignments[eanKey] === grund) {
            delete assignments[eanKey];
          }
        });
        updateUI();
      });
      btn.appendChild(removeBtn);
    });

    // 4) Confirm-Pfeil aktivieren, sobald 2 EANs verteilt sind
    if (totalAssigned() === eans.length) {
      buttons.confirmReason2.disabled = false;
      buttons.confirmReason2.style.color = "#4caf50";
      buttons.confirmReason2.style.cursor = "pointer";
      // Fokus sofort auf den Confirm-Pfeil
      buttons.confirmReason2.focus();
    } else {
      buttons.confirmReason2.disabled = true;
      buttons.confirmReason2.style.color = "white";
      buttons.confirmReason2.style.cursor = "not-allowed";
    }
  }

  // 0) Grid leeren & Confirm zurücksetzen
  grid.innerHTML = "";
  buttons.confirmReason2.disabled = true;
  buttons.confirmReason2.style.color = "white";
  buttons.confirmReason2.style.cursor = "not-allowed";

  // 1) Buttons für alle Gründe erstellen
  reasons.forEach(grund => {
    const btn = document.createElement("button");
    btn.textContent = grund;
    btn.tabIndex = 0;
    btn.style.cssText = `
      padding: 10px;
      font-size: 14px;
      border: 2px solid black;
      border-radius: 6px;
      background: #eee;
      cursor: pointer;
      outline: none;
      position: relative;
      min-height: 60px;
      transition: transform 0.1s ease, border-color 0.1s ease, box-shadow 0.1s ease;
    `;

    // Fokus-Styling
    btn.addEventListener("focus", () => btn.classList.add("keyboard-selected"));
    btn.addEventListener("blur", () => btn.classList.remove("keyboard-selected"));

    // Klick (Maus)
    btn.addEventListener("click", () => {
      const aktuellZugewiesen = Object.entries(assignments)
        .filter(([, g]) => g === grund)
        .map(([ean]) => ean);

      // a) Wenn 0 EANs zugewiesen UND insgesamt < 2, ordne erste EAN zu
      if (aktuellZugewiesen.length === 0 && totalAssigned() < eans.length) {
        const frei = nextFreeEAN();
        if (frei) {
          assignments[frei] = grund;
          updateUI();
        }
        return;
      }

      // b) Wenn genau 1 EAN zugewiesen UND insgesamt < 2, ordne zweite EAN zu
      if (aktuellZugewiesen.length === 1 && totalAssigned() < eans.length) {
        const frei = nextFreeEAN();
        if (frei) {
          assignments[frei] = grund;
          updateUI();
        }
        return;
      }

      // c) Sonst: nichts (Löschen nur per "×")
    });

    // Tastatur-Logik
    btn.addEventListener("keydown", e => {
      const btns = Array.from(grid.querySelectorAll("button"));
      const index = btns.indexOf(btn);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        btns[(index + 1) % btns.length].focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        btns[(index - 1 + btns.length) % btns.length].focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        btn.click();
        if (totalAssigned() === eans.length) {
          buttons.confirmReason2.focus();
        }
      }
    });

    grid.appendChild(btn);
  });

    // === Confirm-Button für Zwei-EAN (Maus oder Enter) ===
// ─── Innerhalb von buildReasonGrid2(…) ───
// … nachdem ihr alle Buttons gerendert habt …

// 2) Confirm-Button (Klick oder Enter) → Tickets senden + Reset + Tile-Ansicht
buttons.confirmReason2.onclick = () => {
  if (Object.keys(assignments).length < eans.length) return;

  // a) Für jede EAN ein Ticket senden
  Object.entries(assignments).forEach(([ean, grund]) => {
    sendZalandoTicket({
      kachelname: currentTileName,
      orderId:    inputs.best1.value.trim(),
      eans:       [ean],
      reason:     grund
    });
  });

  // b) Komplettes Zurücksetzen
  resetZalandoFlowCompletely();
  Object.keys(assignments).forEach(key => delete assignments[key]);

  // c) Zur Tile-Übersicht wechseln
  hideAllViews();
  showView("tile");
};

// ← Änderung hier: auch bei confirmReason2 stoppen wir die Propagation
buttons.confirmReason2.addEventListener("keydown", e => {
  if (e.key === "Enter" && !buttons.confirmReason2.disabled) {
    e.preventDefault();
    e.stopImmediatePropagation();
    buttons.confirmReason2.click();
  }
});


  // Auf Enter in Confirm-Pfeil ebenfalls auslösen
  buttons.confirmReason2.addEventListener("keydown", e => {
    if (e.key === "Enter" && !buttons.confirmReason2.disabled) {
      e.preventDefault();
      buttons.confirmReason2.click();
    }
  });


  // 3) Fokus initial auf den ersten Button setzen
  setTimeout(() => {
    const firstBtn = grid.querySelector("button");
    if (firstBtn) firstBtn.focus();
  }, 50);
}





  async function sendZalandoTicket({ kachelname, orderId, eans, reason }) {
    const payload = {
      kachelname,
      orderId,
      eans,
      reason,
      personalnummer: inputs.persNr.value.trim(),
      filialnummer:   inputs.filNr.value.trim()
    };
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Status ${res.status}: ${text}`);
      }
    } catch (err) {
      console.error("Fehler beim Erstellen des Tickets:", err);
      alert("Fehler beim Erstellen des Tickets: " + err.message);
    }
  }

  // ─────────── Passwort-Reset-Flow ───────────
  Array.from(containers.pass1.querySelectorAll(".passwort-reason")).forEach(btn => {
    btn.addEventListener("click", () => {
      passReason = btn.dataset.reason;
      document.getElementById("passwortHeadline").textContent = `Grund: ${passReason}`;
      hideAllViews();
      showView("pass2");
      focusDelayed(inputs.newPassword);
    });
  });

// ─── Keyboard-Navigation bei „Zalando Passwort zurücksetzen“ ───
const passButtons = Array.from(containers.pass1.querySelectorAll(".passwort-reason"));

passButtons.forEach((btn, idx) => {
  // 1) Pfeiltasten + Enter
  btn.addEventListener("keydown", e => {
    const btns = passButtons;
    const index = idx;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      // nächsten Button fokussieren (Wrap-around)
      e.preventDefault();
      const next = (index + 1) % btns.length;
      btns[next].focus();
    }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      // vorherigen Button fokussieren (Wrap-around)
      e.preventDefault();
      const prev = (index - 1 + btns.length) % btns.length;
      btns[prev].focus();
    }
    else if (e.key === "Enter") {
      e.preventDefault();
      btn.click(); // löst den Klick-Handler aus
    }
  });
});

// ─── Wenn man zum „Passwort zurücksetzen“-Screen wechselt, sofort ersten Button fokussieren ───
function focusFirstPasswortReason() {
  setTimeout(() => {
    if (passButtons.length > 0) {
      passButtons[0].focus();
    }
  }, 50);
}

// Ergänze in deinem selectTile oder showView-Block für "Zalando Passwort zurücksetzen" genau diese Zeile:


  inputs.newPassword.addEventListener("input", () => {
    buttons.passConfirm.style.color = inputs.newPassword.value.trim() ? "green" : "white";
  });

  inputs.newPassword.addEventListener("keydown", e => {
    if (e.key === "Enter" && inputs.newPassword.value.trim()) {
      e.preventDefault();
      buttons.passConfirm.click();
    }
  });

  buttons.passConfirm.addEventListener("click", async e => {
    e.preventDefault();
    const np = inputs.newPassword.value.trim();
    if (!np) return;
    if (!passReason) {
      alert("Bitte zuerst einen Grund auswählen.");
      return;
    }
    if (hasSent) return;

    hasSent = true;
    const payload = {
      kachelname: "Zalando Passwort zurücksetzen",
      reason:     passReason,
      password:   np,
      personalnummer: inputs.persNr.value.trim(),
      filialnummer:   inputs.filNr.value.trim()
    };

    try {
      const res = await fetch(API_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload)
      });
      const responseText = await res.text();
      if (!res.ok) throw new Error(`Status ${res.status}: ${responseText}`);
      // Erfolgreich: zurück zur Startseite
      inputs.newPassword.value = "";
      buttons.passConfirm.style.color = "white";
      showView("tile");
    } catch (err) {
      console.error("❌ Fehler beim Passwort-Reset:", err);
      alert("Fehler beim Passwort-Reset: " + err.message);
    } finally {
      hasSent = false;
    }
  });

  // ─────────── Sonstiges-Anliegen-Flow ───────────
  inputs.sonstiges.addEventListener("input", () => {
    buttons.sonstConfirm.style.color = inputs.sonstiges.value.trim() ? "green" : "white";
  });

  // Enter im Textfeld => Klick auf Bestätigungs-Button auslösen
  inputs.sonstiges.addEventListener("keydown", e => {
    if (e.key === "Enter" && inputs.sonstiges.value.trim()) {
      e.preventDefault();            // verhindert Zeilenumbruch
      e.stopImmediatePropagation();  // blockt globale Shortcuts
      buttons.sonstConfirm.click();  // löst vorhandenen Click-Handler aus
    }
  });

  // Enter auf dem Button selbst => wie ein Klick behandeln
  buttons.sonstConfirm.addEventListener("keydown", e => {
    if (e.key === "Enter" && !buttons.sonstConfirm.disabled) {
      e.preventDefault();
      e.stopImmediatePropagation();
      buttons.sonstConfirm.click();
    }
  });


  buttons.sonstConfirm.addEventListener("click", async e => {
    e.preventDefault();
    const text = inputs.sonstiges.value.trim();
    if (!text || hasSent) return;

    hasSent = true;
    const payload = {
      kachelname: "Sonstiges Anliegen",
      text,
      personalnummer: inputs.persNr.value.trim(),
      filialnummer: inputs.filNr.value.trim()
    };
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const respText = await res.text();
      if (!res.ok) throw new Error(`Status ${res.status}: ${respText}`);
      inputs.sonstiges.value = "";
      buttons.sonstConfirm.style.color = "white";
      showView("tile");
    } catch (err) {
      console.error("Fehler Sonstiges:", err);
      alert("Fehler: " + err.message);
      showView("sonstiges");
    } finally {
      hasSent = false;
    }
  });

  // ─────────── Speichern & Session-Start ───────────
  buttons.save.addEventListener("click", () => {
    if (!(inputs.persNr.value.trim() && inputs.filNr.value.trim())) {
      [inputs.persNr, inputs.filNr].forEach(i => {
        if (!i.value.trim()) i.style.border = "2px solid red";
      });
      return;
    }
    localStorage.setItem(SESSION_KEYS.persNr, inputs.persNr.value.trim());
    localStorage.setItem(SESSION_KEYS.filNr, inputs.filNr.value.trim());
    const expiresAt = new Date(Date.now() + 12 * 3600 * 1000);
    localStorage.setItem(SESSION_KEYS.expiresAt, expiresAt.toISOString());
    setTimeout(expireSession, expiresAt - new Date());

    updateFilialPlaceholder();
    enableAllTiles();
    document.getElementById("savedNotice").style.display = "block";
    setTimeout(() => document.getElementById("savedNotice").style.display = "none", 4000);
    showView("tile");
  });

  // ─────────── Initialisierung beim Laden ───────────
 (function initializeApp() {
  hideAllViews();
  showView("tile");

  // 1) Versuche zuerst, „Zalando Bestellung nicht erfüllbar“ auszuwählen,
  //    sofern sie nicht disabled ist:
  const idxZalando = tiles.findIndex(t => 
    t.dataset.kachelname === "Zalando Bestellung nicht erfüllbar" &&
    !t.classList.contains("disabled")
  );
  if (idxZalando >= 0) {
    selectedTileIndex = idxZalando;
  } else {
    // 2) Falls „Zalando Bestellung nicht erfüllbar“ nicht verfügbar, dann
    //    wie gewohnt den zuletzt gespeicherten Index verwenden, wenn gültig:
    const rawIndex = +localStorage.getItem(SESSION_KEYS.lastTileIndex);
    if (
      !isNaN(rawIndex) &&
      rawIndex < tiles.length &&
      !tiles[rawIndex].classList.contains("disabled") &&
      tiles[rawIndex].dataset.kachelname !== "Coming Soon"
    ) {
      selectedTileIndex = rawIndex;
    } else {
      // 3) Und ansonsten die erste nicht-„Coming Soon“, nicht-disabled Kachel
      selectedTileIndex = tiles.findIndex(t => {
        return (
          !t.classList.contains("disabled") &&
          t.dataset.kachelname !== "Coming Soon"
        );
      });
      if (selectedTileIndex < 0) selectedTileIndex = 0;
    }
  }

  // 4) Optische Hervorhebung & Fokus auf die gewählte Kachel
  updateTileSelection();

  disableAllTiles();

    const savedPers = localStorage.getItem(SESSION_KEYS.persNr);
    const savedFil  = localStorage.getItem(SESSION_KEYS.filNr);
    if (savedPers) inputs.persNr.value = savedPers;
    if (savedFil)  inputs.filNr.value  = savedFil;
    updateFilialPlaceholder();
    validatePersonalFilial();

    if (!inputs.persNr.value.trim()) {
      inputs.persNr.focus();
    }
  })();
});
