"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DressCatalogData } from "@/lib/dressCatalogData";
import { TERMS_VERSION } from "@/lib/site";

type Brand = { id: string; name: string };
type Dress = Record<string, any> & {
  id?: string;
  status?: string;
  dress_photos?: any[];
  dress_characteristics?: any[];
  brand_suggestions?: any;
  dress_declarations?: any;
};

type ValidationIssue = { step: number; key: string; label: string; message: string };

const stepNames = ["Identidad", "Talla y medidas", "Diseño", "Condición", "Alteraciones", "Precio", "Envío", "Descripción", "Fotografías", "Revisión"];
const fieldsByStep: string[][] = [
  ["brand_id", "brand_suggestion_id", "model", "collection", "year_approx"],
  ["talla_etiqueta", "sistema_talla", "busto_cm", "cintura_cm", "cadera_cm", "largo_hombro_piso_cm", "altura_persona_cm", "altura_tacon_cm", "puede_ampliarse", "puede_reducirse"],
  ["silueta", "escote", "espalda", "manga", "tela_principal", "tela_secundaria", "color_principal", "color_forro", "cola", "cola_largo_cm"],
  ["condicion", "tiene_manchas", "tiene_jalones", "tiene_roturas", "dano_dobladillo", "falta_aplicaciones", "tiene_reparaciones", "tiene_decoloracion", "descripcion_danos"],
  ["tuvo_ajustes", "ajustes_detalle", "conserva_margen_costura"],
  ["precio_original_mxn", "precio_venta_mxn"],
  ["envio_nacional"],
  ["descripcion"],
  [],
  [],
];
const numeric = new Set(["year_approx", "busto_cm", "cintura_cm", "cadera_cm", "largo_hombro_piso_cm", "altura_persona_cm", "altura_tacon_cm", "cola_largo_cm", "precio_original_mxn", "precio_venta_mxn"]);
const requiredKeys = new Set(["talla_etiqueta", "silueta", "escote", "espalda", "manga", "tela_principal", "color_principal", "cola", "condicion", "precio_venta_mxn"]);

export default function DressPublishForm({ initialDress, brands, catalogs, userId }: { initialDress?: Dress; brands: Brand[]; catalogs: DressCatalogData; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const initialBrand = initialDress?.brand_id
    ? brands.find((b) => b.id === initialDress.brand_id)?.name || ""
    : initialDress?.brand_suggestions?.suggested_name || "";
  const initialDeclaration = Array.isArray(initialDress?.dress_declarations) ? initialDress?.dress_declarations?.[0] : initialDress?.dress_declarations;

  const [step, setStep] = useState(0);
  const [dress, setDress] = useState<Dress>(initialDress ?? { seller_id: userId, status: "draft", sistema_talla: "MX", envio_nacional: true });
  const [brandQuery, setBrandQuery] = useState(initialBrand);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<any[]>(initialDress?.dress_photos ?? []);
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<string[]>(initialDress?.dress_characteristics?.map((x: any) => x.characteristic_id) ?? []);
  const [decl, setDecl] = useState({
    authentic: Boolean(initialDeclaration?.authenticity_declared),
    photos: Boolean(initialDeclaration?.photos_correspond_declared),
    right: Boolean(initialDeclaration?.right_to_sell_declared),
    trueInfo: Boolean(initialDeclaration?.information_true_declared),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const exactBrand = brands.find((b) => b.name.localeCompare(brandQuery.trim(), undefined, { sensitivity: "base" }) === 0);
  const matches = brandQuery.trim() ? brands.filter((b) => b.name.toLowerCase().includes(brandQuery.trim().toLowerCase())).slice(0, 8) : brands.slice(0, 8);

  function issuesForStep(stepIndex: number): ValidationIssue[] {
    const missing = (key: string, label: string, message = "Este campo es obligatorio."): ValidationIssue | null => {
      const value = dress[key];
      return value === null || value === undefined || String(value).trim() === "" ? { step: stepIndex, key, label, message } : null;
    };
    const results: (ValidationIssue | null)[] = [];

    if (stepIndex === 0 && !dress.brand_id && !dress.brand_suggestion_id) results.push({ step: 0, key: "brand", label: "Marca", message: "Selecciona una marca o envíala para revisión." });
    if (stepIndex === 1) results.push(missing("talla_etiqueta", "Talla de etiqueta"));
    if (stepIndex === 2) {
      results.push(missing("silueta", "Silueta"), missing("escote", "Escote"), missing("espalda", "Espalda"), missing("manga", "Manga"), missing("tela_principal", "Tela principal"), missing("color_principal", "Color principal"), missing("cola", "Cola"));
    }
    if (stepIndex === 3) results.push(missing("condicion", "Condición"));
    if (stepIndex === 5) {
      const price = Number(dress.precio_venta_mxn);
      if (!dress.precio_venta_mxn || !Number.isFinite(price) || price <= 0) results.push({ step: 5, key: "precio_venta_mxn", label: "Precio de venta", message: "Ingresa un precio de venta mayor a cero." });
    }
    if (stepIndex === 8 && photos.length < 3) results.push({ step: 8, key: "photos", label: "Fotografías", message: `Sube al menos 3 fotografías. Actualmente hay ${photos.length}.` });
    if (stepIndex === 9) {
      if (!decl.authentic) results.push({ step: 9, key: "decl_authentic", label: "Declaración de autenticidad", message: "Debes aceptar esta declaración." });
      if (!decl.photos) results.push({ step: 9, key: "decl_photos", label: "Declaración sobre fotografías", message: "Debes aceptar esta declaración." });
      if (!decl.right) results.push({ step: 9, key: "decl_right", label: "Declaración de derecho para vender", message: "Debes aceptar esta declaración." });
      if (!decl.trueInfo) results.push({ step: 9, key: "decl_true", label: "Declaración de información verdadera", message: "Debes aceptar esta declaración." });
    }
    return results.filter(Boolean) as ValidationIssue[];
  }

  function allIssues() {
    return stepNames.flatMap((_, index) => issuesForStep(index));
  }

  function applyIssues(issues: ValidationIssue[]) {
    setErrors(Object.fromEntries(issues.map((issue) => [issue.key, issue.message])));
    if (issues.length) setMessage("Completa los campos obligatorios marcados antes de continuar.");
  }

  function clearError(key: string) {
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function ensureDraft() {
    if (dress.id) return dress.id;
    const { data, error } = await supabase.from("dresses").insert({ seller_id: userId, status: "draft", sistema_talla: "MX", envio_nacional: true }).select("id").single();
    if (error) throw error;
    setDress((d) => ({ ...d, id: data.id }));
    return data.id;
  }

  function chooseBrand(b: Brand) {
    setBrandQuery(b.name);
    setDress((d) => ({ ...d, brand_id: b.id, brand_suggestion_id: null }));
    clearError("brand");
  }

  async function suggestBrand() {
    const name = brandQuery.trim();
    if (name.length < 2) {
      setErrors((e) => ({ ...e, brand: "Escribe el nombre de la marca." }));
      return;
    }
    setBusy(true);
    try {
      const id = await ensureDraft();
      const { data, error } = await supabase.from("brand_suggestions").insert({ suggested_name: name, seller_id: userId, dress_id: id }).select("id,suggested_name,status").single();
      if (error) throw error;
      setDress((d) => ({ ...d, brand_id: null, brand_suggestion_id: data.id, brand_suggestions: data }));
      clearError("brand");
      setMessage("Marca enviada para revisión. Puedes seguir guardando tu borrador.");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const id = await ensureDraft();
      const payload: any = {};
      for (const f of fieldsByStep.flat()) {
        if (f in dress) {
          const v = dress[f];
          payload[f] = numeric.has(f) ? (v === "" || v == null ? null : Number(v)) : v;
        }
      }
      const { error } = await supabase.from("dresses").update(payload).eq("id", id);
      if (error) throw error;
      const { error: deleteChars } = await supabase.from("dress_characteristics").delete().eq("dress_id", id);
      if (deleteChars) throw deleteChars;
      if (selectedCharacteristics.length) {
        const { error: insertChars } = await supabase.from("dress_characteristics").insert(selectedCharacteristics.map((characteristic_id) => ({ dress_id: id, characteristic_id })));
        if (insertChars) throw insertChars;
      }
      setMessage("Borrador guardado.");
      return id;
    } catch (e: any) {
      setMessage(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const id = await ensureDraft();
      for (const [i, file] of Array.from(files).entries()) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/${id}/${crypto.randomUUID()}.${ext}`;
        const { error: up } = await supabase.storage.from("dress-images").upload(path, file, { upsert: false });
        if (up) throw up;
        const { data, error } = await supabase.from("dress_photos").insert({ dress_id: id, storage_path: path, position: photos.length + i, is_primary: photos.length + i === 0, classification: "frontal" }).select().single();
        if (error) throw error;
        setPhotos((p) => [...p, data]);
      }
      clearError("photos");
      setMessage("Fotografías subidas.");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function nextStep() {
    const issues = issuesForStep(step);
    if (issues.length) {
      applyIssues(issues);
      return;
    }
    setErrors({});
    try {
      await save();
      setStep((s) => Math.min(9, s + 1));
    } catch {}
  }

  async function submit() {
    const issues = allIssues();
    if (issues.length) {
      applyIssues(issues);
      setMessage("La publicación aún no está completa. Revisa el resumen de pendientes.");
      return;
    }
    setBusy(true);
    try {
      const id = await save();
      const { error: declarationError } = await supabase.from("dress_declarations").upsert({
        dress_id: id,
        seller_id: userId,
        authenticity_declared: decl.authentic,
        photos_correspond_declared: decl.photos,
        right_to_sell_declared: decl.right,
        information_true_declared: decl.trueInfo,
        terms_version: TERMS_VERSION,
        declared_at: new Date().toISOString(),
      }, { onConflict: "dress_id" });
      if (declarationError) throw declarationError;
      const { error } = await supabase.from("dresses").update({ status: "pending_review" }).eq("id", id);
      if (error) throw error;
      router.push("/mis-vestidos");
      router.refresh();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  function set(name: string, value: any) {
    setDress((d) => ({ ...d, [name]: value }));
    clearError(name);
  }

  function options(name: string, label: string, opts: { value: string; label: string }[]) {
    return <div className={`field ${errors[name] ? "field-invalid" : ""}`}>
      <label>{label}{requiredKeys.has(name) && <span className="required-mark"> *</span>}</label>
      <select value={dress[name] ?? ""} onChange={(e) => set(name, e.target.value || null)} aria-invalid={Boolean(errors[name])}>
        <option value="">Selecciona</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {errors[name] && <p className="field-error">{errors[name]}</p>}
    </div>;
  }

  function input(name: string, label: string, type = "text") {
    return <div className={`field ${errors[name] ? "field-invalid" : ""}`}>
      <label>{label}{requiredKeys.has(name) && <span className="required-mark"> *</span>}</label>
      <input type={type} value={dress[name] ?? ""} onChange={(e) => set(name, e.target.value)} aria-invalid={Boolean(errors[name])} />
      {errors[name] && <p className="field-error">{errors[name]}</p>}
    </div>;
  }

  function check(name: string, label: string) {
    return <label className="check"><input type="checkbox" checked={Boolean(dress[name])} onChange={(e) => set(name, e.target.checked)} /><span>{label}</span></label>;
  }

  function stepClick(target: number) {
    if (target <= step) {
      setStep(target);
      setErrors({});
      setMessage("");
      return;
    }
    if (target === step + 1) {
      void nextStep();
      return;
    }
    setMessage("Completa los pasos en orden antes de avanzar.");
  }

  const pending = allIssues();
  const pendingByStep = stepNames.map((name, index) => ({ name, index, items: pending.filter((issue) => issue.step === index) })).filter((group) => group.items.length > 0);

  return <div className="wizard">
    <div className="stepper">{stepNames.map((n, i) => <button key={n} type="button" className={i === step ? "active" : ""} onClick={() => stepClick(i)}>{i + 1}. {n}</button>)}</div>
    <section className="panel">
      <h1>{initialDress?.id ? "Editar vestido" : "Publicar vestido"}</h1>
      <h2>{stepNames[step]}</h2>
      {dress.status === "changes_requested" && dress.moderation_notes && <div className="alert-error"><strong>Cambios solicitados por SECOND VOW:</strong><p>{dress.moderation_notes}</p></div>}

      {step === 0 && <>
        <div className={`field brand-search ${errors.brand ? "field-invalid" : ""}`}>
          <label>Marca<span className="required-mark"> *</span></label>
          <input value={brandQuery} onChange={(e) => { setBrandQuery(e.target.value); setDress((d) => ({ ...d, brand_id: null, brand_suggestion_id: null })); clearError("brand"); }} placeholder="Empieza a escribir una marca…" aria-invalid={Boolean(errors.brand)} />
          <div className="brand-suggestions">{matches.map((b) => <button type="button" key={b.id} onClick={() => chooseBrand(b)}>{b.name}</button>)}</div>
          {brandQuery.trim() && !exactBrand && !dress.brand_suggestion_id && <div className="brand-new"><p>No encontramos una coincidencia exacta.</p><strong>Nombre de la marca</strong><div>{brandQuery}</div><button type="button" className="btn btn-secondary" disabled={busy} onClick={suggestBrand}>Enviar marca para revisión</button></div>}
          {dress.brand_suggestion_id && <p className="muted">Marca sugerida: <strong>{dress.brand_suggestions?.suggested_name || brandQuery}</strong> · pendiente de revisión.</p>}
          {errors.brand && <p className="field-error">{errors.brand}</p>}
        </div>
        {input("model", "Modelo")}{input("collection", "Colección")}{input("year_approx", "Año aproximado", "number")}
      </>}

      {step === 1 && <><div className="grid-2">{options("talla_etiqueta", "Talla de etiqueta", catalogs.sizes)}{options("sistema_talla", "Sistema de talla", catalogs.sizingSystems)}{input("busto_cm", "Busto (cm)", "number")}{input("cintura_cm", "Cintura (cm)", "number")}{input("cadera_cm", "Cadera (cm)", "number")}{input("largo_hombro_piso_cm", "Hombro a piso (cm)", "number")}{input("altura_persona_cm", "Altura de quien lo usó (cm)", "number")}{input("altura_tacon_cm", "Altura de tacón (cm)", "number")}</div>{check("puede_ampliarse", "Puede ampliarse")}{check("puede_reducirse", "Puede reducirirse")}</>}

      {step === 2 && <><div className="grid-2">{options("silueta", "Silueta", catalogs.silhouettes)}{options("escote", "Escote", catalogs.necklines)}{options("espalda", "Espalda", catalogs.backs)}{options("manga", "Manga", catalogs.sleeves)}{options("tela_principal", "Tela principal", catalogs.fabrics)}{options("tela_secundaria", "Tela secundaria", catalogs.fabrics)}{options("color_principal", "Color principal", catalogs.colors)}{input("color_forro", "Color del forro")}{options("cola", "Cola", catalogs.trains)}{input("cola_largo_cm", "Largo de cola (cm)", "number")}</div><fieldset className="filter-group"><legend>Características y detalles</legend><div className="filter-options">{catalogs.characteristics.map((c) => <label key={c.id} className="filter-check"><input type="checkbox" checked={selectedCharacteristics.includes(c.id)} onChange={() => setSelectedCharacteristics((current) => current.includes(c.id) ? current.filter((x) => x !== c.id) : [...current, c.id])} /><span>{c.label}</span></label>)}</div></fieldset></>}

      {step === 3 && <>{options("condicion", "Condición", catalogs.conditions)}<div className="checks">{check("tiene_manchas", "Tiene manchas")}{check("tiene_jalones", "Tiene jalones")}{check("tiene_roturas", "Tiene roturas")}{check("dano_dobladillo", "Daño en dobladillo")}{check("falta_aplicaciones", "Faltan aplicaciones")}{check("tiene_reparaciones", "Tiene reparaciones")}{check("tiene_decoloracion", "Tiene decoloración")}</div><div className="field"><label>Describe daños o imperfecciones</label><textarea value={dress.descripcion_danos ?? ""} onChange={(e) => set("descripcion_danos", e.target.value)} rows={5} /></div></>}

      {step === 4 && <>{check("tuvo_ajustes", "Tuvo ajustes o alteraciones")}<div className="field"><label>Detalle de ajustes</label><textarea rows={5} value={dress.ajustes_detalle ?? ""} onChange={(e) => set("ajustes_detalle", e.target.value)} /></div>{check("conserva_margen_costura", "Conserva margen de costura")}</>}

      {step === 5 && <div className="grid-2">{input("precio_original_mxn", "Precio original (MXN)", "number")}{input("precio_venta_mxn", "Precio de venta (MXN)", "number")}</div>}
      {step === 6 && <><p>Todos los vestidos publicados en SECOND VOW deben estar disponibles para envío.</p><p className="muted">No se ofrecen pruebas ni entregas presenciales.</p></>}
      {step === 7 && <div className="field"><label>Descripción adicional</label><textarea rows={10} value={dress.descripcion ?? ""} onChange={(e) => set("descripcion", e.target.value)} placeholder="Cuenta libremente la historia, detalles, accesorios incluidos o cualquier dato adicional relevante." /></div>}
      {step === 8 && <><div className={`field ${errors.photos ? "field-invalid" : ""}`}><label>Fotografías (mínimo 3)<span className="required-mark"> *</span></label><input type="file" accept="image/*" multiple onChange={(e) => upload(e.target.files)} />{errors.photos && <p className="field-error">{errors.photos}</p>}</div><div className="photo-list">{photos.map((p, i) => <div key={p.id}>Foto {i + 1}{p.is_primary ? " · principal" : ""}</div>)}</div></>}

      {step === 9 && <div className="publish-declarations">
        <div className={pendingByStep.length ? "review-summary review-summary-pending" : "review-summary review-summary-complete"}>
          <h3>{pendingByStep.length ? "Antes de enviar, completa lo siguiente:" : "Publicación completa"}</h3>
          {pendingByStep.length ? pendingByStep.map((group) => <div className="review-summary-step" key={group.index}><button type="button" onClick={() => setStep(group.index)}>{group.index + 1}. {group.name}</button><ul>{group.items.map((issue) => <li key={issue.key}>{issue.label}: {issue.message}</li>)}</ul></div>) : <p>Ya completaste los datos obligatorios. Confirma las declaraciones y envía el vestido a revisión.</p>}
        </div>
        <p>Antes de enviar a revisión confirma lo siguiente:</p>
        <label className={`check ${errors.decl_authentic ? "check-invalid" : ""}`}><input type="checkbox" checked={decl.authentic} onChange={(e) => { setDecl((d) => ({ ...d, authentic: e.target.checked })); clearError("decl_authentic"); }} /><span>Declaro bajo protesta que el vestido es auténtico y no una falsificación.</span></label>
        <label className={`check ${errors.decl_photos ? "check-invalid" : ""}`}><input type="checkbox" checked={decl.photos} onChange={(e) => { setDecl((d) => ({ ...d, photos: e.target.checked })); clearError("decl_photos"); }} /><span>Declaro que las fotografías corresponden al vestido anunciado.</span></label>
        <label className={`check ${errors.decl_right ? "check-invalid" : ""}`}><input type="checkbox" checked={decl.right} onChange={(e) => { setDecl((d) => ({ ...d, right: e.target.checked })); clearError("decl_right"); }} /><span>Declaro que soy propietaria o tengo derecho para venderlo.</span></label>
        <label className={`check ${errors.decl_true ? "check-invalid" : ""}`}><input type="checkbox" checked={decl.trueInfo} onChange={(e) => { setDecl((d) => ({ ...d, trueInfo: e.target.checked })); clearError("decl_true"); }} /><span>Declaro que la información publicada es verdadera y completa respecto de los aspectos relevantes.</span></label>
        <p className="muted">Estas declaraciones se registran con fecha y versión de los Términos y Condiciones.</p>
      </div>}

      {message && <div className={message.includes("guardado") || message.includes("subidas") || message.includes("enviada") ? "alert-success" : "alert-error"}>{message}</div>}
      <div className="wizard-actions">
        <button className="btn btn-secondary" disabled={step === 0 || busy} onClick={() => { setStep((s) => s - 1); setErrors({}); setMessage(""); }}>Anterior</button>
        <button className="btn btn-secondary" disabled={busy} onClick={save}>Guardar</button>
        {step < 9 ? <button className="btn btn-primary" disabled={busy} onClick={nextStep}>Siguiente</button> : <button className="btn btn-primary" disabled={busy} onClick={submit}>{dress.status === "changes_requested" ? "Reenviar a revisión" : "Enviar a revisión"}</button>}
      </div>
    </section>
  </div>;
}
