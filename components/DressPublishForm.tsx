"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import DressShapePicker from "@/components/DressShapePicker";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DressCatalogData } from "@/lib/dressCatalogData";
import { TERMS_VERSION } from "@/lib/site";
import { optimizeDressImage, validateUploadMedia } from "@/lib/mediaValidation";
import { DRESS_REQUIRED_FIELDS } from "@/lib/dressRequirements";
import { dressImageUrl } from "@/lib/storage";

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

const stepNames = ["Datos del vestido", "Condición y descripción", "Precio y fotografías", "Revisión y publicación"];
const fieldsByStep: string[][] = [
  ["brand_id", "brand_suggestion_id", "model", "collection", "year_approx"],
  ["talla_etiqueta", "sistema_talla", "busto_cm", "cintura_cm", "cadera_cm", "largo_hombro_piso_cm", "altura_persona_cm", "altura_tacon_cm", "puede_ampliarse", "puede_reducirse"],
  ["silueta", "escote", "espalda", "manga", "tela_principal", "tela_secundaria", "color_principal", "color_forro", "cola", "cola_largo_cm"],
  ["condicion", "tiene_manchas", "tiene_jalones", "tiene_roturas", "dano_dobladillo", "falta_aplicaciones", "tiene_reparaciones", "tiene_decoloracion", "descripcion_danos"],
  ["tuvo_ajustes", "ajustes_detalle", "conserva_margen_costura"],
  ["precio_original_mxn", "precio_venta_mxn"],
  ["descripcion"],
  [],
  [],
];
const numeric = new Set(["year_approx", "busto_cm", "cintura_cm", "cadera_cm", "largo_hombro_piso_cm", "altura_persona_cm", "altura_tacon_cm", "cola_largo_cm", "precio_original_mxn", "precio_venta_mxn"]);
// Tela principal, color principal y cola son recomendados pero ya NO obligatorios:
// una publicación completa inspira más confianza, pero no bloqueamos la venta por esto.
const requiredKeys = new Set<string>(DRESS_REQUIRED_FIELDS.map(([key])=>key).filter((key)=>key!=="brand"));
const recommendedKeys: { key: string; label: string }[] = [
  { key: "tela_principal", label: "Tela principal" },
  { key: "color_principal", label: "Color principal" },
  { key: "cola", label: "Cola" },
];

function firstIncompleteStep(dress?: Dress) {
  if (!dress?.id) return 0;
  if ((!dress.brand_id && !dress.brand_suggestion_id) || !dress.talla_etiqueta || !dress.silueta || !dress.escote || !dress.espalda || !dress.manga) return 0;
  if (!dress.condicion) return 1;
  if (!dress.precio_venta_mxn || Number(dress.precio_venta_mxn) <= 0 || (dress.dress_photos?.length ?? 0) === 0) return 2;
  return 3;
}

export default function DressPublishForm({ initialDress, brands, catalogs, userId }: { initialDress?: Dress; brands: Brand[]; catalogs: DressCatalogData; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const initialBrand = initialDress?.brand_id
    ? brands.find((b) => b.id === initialDress.brand_id)?.name || ""
    : initialDress?.brand_suggestions?.suggested_name || "";
  const initialDeclaration = Array.isArray(initialDress?.dress_declarations) ? initialDress?.dress_declarations?.[0] : initialDress?.dress_declarations;

  const [step, setStep] = useState(() => firstIncompleteStep(initialDress));
  const [dress, setDress] = useState<Dress>(() => {
    if (!initialDress) return { seller_id: userId, status: "draft", sistema_talla: "MX", envio_nacional: true };
    const descriptions = [...new Set([initialDress.descripcion, initialDress.descripcion_danos, initialDress.ajustes_detalle].map((value) => String(value ?? "").trim()).filter(Boolean))];
    return { ...initialDress, descripcion: descriptions.join("\n\n"), descripcion_danos: null, ajustes_detalle: null };
  });
  const [brandQuery, setBrandQuery] = useState(initialBrand);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<any[]>(initialDress?.dress_photos ?? []);
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(initialDress?.dress_photos?.find((p: any) => p.is_primary)?.id ?? initialDress?.dress_photos?.[0]?.id ?? null);
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<string[]>(initialDress?.dress_characteristics?.map((x: any) => x.characteristic_id) ?? []);
  const [decl, setDecl] = useState({
    authentic: Boolean(initialDeclaration?.authenticity_declared),
    photos: Boolean(initialDeclaration?.photos_correspond_declared),
    right: Boolean(initialDeclaration?.right_to_sell_declared),
    trueInfo: Boolean(initialDeclaration?.information_true_declared),
    promotionalImages: Boolean(initialDeclaration?.promotional_image_license_declared),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const draftId = useRef<string | undefined>(initialDress?.id);
  const saveInFlight = useRef(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(initialDress?.id ? "saved" : "idle");
  const snapshot = JSON.stringify([fieldsByStep.flat().map((key) => [key, dress[key] ?? null]), dress.pending_brand_name ?? null, selectedCharacteristics.slice().sort()]);
  const savedSnapshot = useRef(initialDress?.id ? snapshot : "");
  const failedSnapshot = useRef("");
  const hasEnteredData = Boolean(brandQuery.trim() || selectedCharacteristics.length || fieldsByStep.flat().some((key) => !["sistema_talla"].includes(key) && dress[key] !== null && dress[key] !== undefined && dress[key] !== "" && dress[key] !== false));
  const savedCharacteristics = useRef((initialDress?.dress_characteristics?.map((x: any) => x.characteristic_id) ?? []).slice().sort().join(","));

  const exactBrand = brands.find((b) => b.name.localeCompare(brandQuery.trim(), undefined, { sensitivity: "base" }) === 0);
  const noBrand = brands.find((b) => b.name.localeCompare("SIN MARCA", undefined, { sensitivity: "base" }) === 0);
  const matches = brandQuery.trim() ? brands.filter((b) => b.name.toLowerCase().includes(brandQuery.trim().toLowerCase())).slice(0, 8) : brands.slice(0, 8);

  function issuesForStep(stepIndex: number): ValidationIssue[] {
    const missing = (key: string, label: string, message = "Este campo es obligatorio."): ValidationIssue | null => {
      const value = dress[key];
      return value === null || value === undefined || String(value).trim() === "" ? { step: stepIndex, key, label, message } : null;
    };
    const results: (ValidationIssue | null)[] = [];

    if (stepIndex === 0 && !dress.brand_id && !dress.brand_suggestion_id && !dress.pending_brand_name) results.push({ step: 0, key: "brand", label: "Marca", message: "Selecciona una marca, usa Sin marca o escribe una nueva. No necesitas esperar autorización." });
    if (stepIndex === 0 && dress.year_approx !== null && dress.year_approx !== undefined && String(dress.year_approx).trim() !== "") {
      const year = Number(dress.year_approx);
      if (!Number.isInteger(year) || year < 1950 || year > 2100) results.push({ step: 0, key: "year_approx", label: "Año aproximado", message: "Ingresa un año entre 1950 y 2100." });
    }
    if (stepIndex === 0) results.push(missing("talla_etiqueta", "Talla de etiqueta"));
    if (stepIndex === 0) {
      results.push(missing("silueta", "Silueta"), missing("escote", "Escote"), missing("espalda", "Espalda"), missing("manga", "Manga"));
    }
    if (stepIndex === 1) results.push(missing("condicion", "Condición"));
    if (stepIndex === 2) {
      const price = Number(dress.precio_venta_mxn);
      if (!dress.precio_venta_mxn || !Number.isFinite(price) || price <= 0) results.push({ step: 2, key: "precio_venta_mxn", label: "Precio de venta", message: "Ingresa un precio de venta mayor a cero." });
    }
    if (stepIndex === 2 && photos.length < 1) results.push({ step: 2, key: "photos", label: "Fotografías", message: `Sube al menos 1 fotografía.` });
    if (stepIndex === 3) {
      if (!decl.authentic) results.push({ step: 3, key: "decl_authentic", label: "Declaración de autenticidad", message: "Debes aceptar esta declaración." });
      if (!decl.photos) results.push({ step: 3, key: "decl_photos", label: "Declaración sobre fotografías", message: "Debes aceptar esta declaración." });
      if (!decl.right) results.push({ step: 3, key: "decl_right", label: "Declaración de derecho para vender", message: "Debes aceptar esta declaración." });
      if (!decl.trueInfo) results.push({ step: 3, key: "decl_true", label: "Declaración de información verdadera", message: "Debes aceptar esta declaración." });
    }
    return results.filter(Boolean) as ValidationIssue[];
  }

  function missingRecommendations(): string[] {
    return recommendedKeys.filter(({ key }) => { const v = dress[key]; return v === null || v === undefined || String(v).trim() === ""; }).map(({ label }) => label);
  }

  function allIssues() {
    return stepNames.flatMap((_, index) => issuesForStep(index));
  }

  function applyIssues(issues: ValidationIssue[]) {
    setErrors(Object.fromEntries(issues.map((issue) => [issue.key, issue.message])));
    if (issues.length) {
      setMessage(`Falta completar: ${issues.map((issue) => issue.label).join(", ")}.`);
    }
  }

  function dbIssues(row: any): ValidationIssue[] {
    const results: ValidationIssue[] = [];
    const add = (stepIndex: number, key: string, label: string, value: any, message = "Este campo es obligatorio.") => {
      if (value === null || value === undefined || String(value).trim() === "") {
        results.push({ step: stepIndex, key, label, message });
      }
    };
    if (!row?.brand_id && !row?.brand_suggestion_id) {
      results.push({ step: 0, key: "brand", label: "Marca", message: "Selecciona una marca, usa Sin marca o escribe una nueva." });
    }
    add(0, "talla_etiqueta", "Talla de etiqueta", row?.talla_etiqueta);
    add(0, "silueta", "Silueta", row?.silueta);
    add(0, "escote", "Escote", row?.escote);
    add(0, "espalda", "Espalda", row?.espalda);
    add(0, "manga", "Manga", row?.manga);
    add(1, "condicion", "Condición", row?.condicion);
    const price = Number(row?.precio_venta_mxn);
    if (!row?.precio_venta_mxn || !Number.isFinite(price) || price <= 0) {
      results.push({ step: 2, key: "precio_venta_mxn", label: "Precio de venta", message: "Ingresa un precio de venta mayor a cero." });
    }
    return results;
  }

  async function validateSavedDress(id: string) {
    const { data, error } = await supabase
      .from("dresses")
      .select("brand_id,brand_suggestion_id,talla_etiqueta,silueta,escote,espalda,manga,condicion,precio_venta_mxn")
      .eq("id", id)
      .single();
    if (error) throw error;
    return dbIssues(data);
  }

  function clearError(key: string) {
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function ensureDraft(payload: Record<string, any> = {}) {
    if (draftId.current) return draftId.current;
    if (issuesForStep(0).length) throw new Error("Completa el primer paso antes de guardar.");
    const { data, error } = await supabase.from("dresses").insert({ ...payload, seller_id: userId, status: "draft", sistema_talla: dress.sistema_talla || "MX", envio_nacional: true }).select("id").single();
    if (error) throw error;
    draftId.current = data.id;
    setDress((d) => ({ ...d, id: data.id }));
    return data.id;
  }

  function chooseBrand(b: Brand) {
    setBrandQuery(b.name);
    setDress((d) => ({ ...d, brand_id: b.id, brand_suggestion_id: null, pending_brand_name: null }));
    clearError("brand");
  }

  function chooseNoBrand() {
    if (!noBrand) {
      setMessage("No pudimos seleccionar Sin marca. Escribe el nombre que aparezca en la etiqueta o solicita ayuda.");
      return;
    }
    chooseBrand(noBrand);
    setMessage("Seleccionaste Sin marca. Puedes continuar con el siguiente paso.");
  }

  function suggestBrand() {
    const name = brandQuery.trim();
    if (name.length < 2) {
      setErrors((e) => ({ ...e, brand: "Escribe el nombre de la marca." }));
      return;
    }
    setDress((d) => ({ ...d, brand_id: null, brand_suggestion_id: null, pending_brand_name: name, brand_suggestions: { suggested_name: name } }));
    clearError("brand");
    setMessage("Marca seleccionada. Completa el primer paso y pulsa Siguiente para guardar tu borrador.");
  }

  function friendlyError(error: any) {
    const raw = String(error?.message || error || "");
    if (/year_approx|dresses_year_approx_valid/i.test(raw)) return "El año aproximado debe estar entre 1950 y 2100.";
    if (/row-level security|policy for table/i.test(raw)) return "No pudimos guardar los cambios. Revisa si hay una compra en curso o si el vestido ya se vendió.";
    return "No pudimos guardar los cambios. Inténtalo de nuevo o contáctanos si el problema continúa.";
  }

  async function save(options: { silent?: boolean } = {}) {
    if (saveInFlight.current) throw new Error("El guardado sigue en proceso.");
    saveInFlight.current = true;
    setBusy(true);
    setSaveState("saving");
    setMessage("");
    try {
      const payload: any = {};
      for (const f of fieldsByStep.flat()) {
        if (f in dress) {
          const v = dress[f];
          payload[f] = numeric.has(f) ? (v === "" || v == null ? null : Number(v)) : v;
        }
      }
      const id = await ensureDraft(payload);
      if (dress.pending_brand_name) {
        const { data: suggestion, error: suggestionError } = await supabase.from("brand_suggestions").insert({ suggested_name: dress.pending_brand_name, seller_id: userId, dress_id: id }).select("id,suggested_name,status").single();
        if (suggestionError) throw suggestionError;
        payload.brand_id = null;
        payload.brand_suggestion_id = suggestion.id;
        setDress((d) => ({ ...d, brand_id: null, brand_suggestion_id: suggestion.id, pending_brand_name: null, brand_suggestions: suggestion }));
      }
      const { error } = await supabase.from("dresses").update(payload).eq("id", id);
      if (error) throw error;
      const currentCharacteristics = selectedCharacteristics.slice().sort().join(",");
      if (currentCharacteristics !== savedCharacteristics.current) {
        const { error: deleteChars } = await supabase.from("dress_characteristics").delete().eq("dress_id", id);
        if (deleteChars) throw deleteChars;
        if (selectedCharacteristics.length) {
          const { error: insertChars } = await supabase.from("dress_characteristics").insert(selectedCharacteristics.map((characteristic_id) => ({ dress_id: id, characteristic_id })));
          if (insertChars) throw insertChars;
        }
        savedCharacteristics.current = currentCharacteristics;
      }
      savedSnapshot.current = snapshot;
      failedSnapshot.current = "";
      setSaveState("saved");
      if (!options.silent) setMessage("Borrador guardado automáticamente.");
      return id;
    } catch (e: any) {
      failedSnapshot.current = snapshot;
      setSaveState("error");
      setMessage(friendlyError(e));
      throw e;
    } finally {
      saveInFlight.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    // New drafts are created only by completing the first step.
    if (!draftId.current || busy || snapshot === savedSnapshot.current || snapshot === failedSnapshot.current || ["sold", "reserved"].includes(dress.status || "")) return;
    const timer = window.setTimeout(() => { void save({ silent: true }).catch(() => undefined); }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dress, selectedCharacteristics, snapshot, busy]);

  useEffect(() => {
    const unsaved = !draftId.current ? hasEnteredData : snapshot !== savedSnapshot.current;
    if (!unsaved) return;
    const warning = !draftId.current
      ? "NO SE VA A GUARDAR tu publicación porque no terminaste el primer paso. Completa los campos obligatorios y pulsa Siguiente. ¿Quieres salir y perder lo que escribiste?"
      : "Hay cambios que todavía no se han guardado. ¿Quieres salir y perder esos cambios?";
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const leaveByLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm(warning)) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", leaveByLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", leaveByLink, true); };
  }, [hasEnteredData, snapshot, saveState, dress.id]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const id = await ensureDraft();
      for (const [i, file] of Array.from(files).entries()) {
        await validateUploadMedia(file);
        const optimizedFile = await optimizeDressImage(file);
        const ext = optimizedFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/${id}/${crypto.randomUUID()}.${ext}`;
        const { error: up } = await supabase.storage.from("dress-images").upload(path, optimizedFile, {
          upsert: false,
          contentType: optimizedFile.type,
          cacheControl: "31536000",
        });
        if (up) throw up;
        const { data, error } = await supabase.from("dress_photos").insert({ dress_id: id, storage_path: path, position: photos.length + i, is_primary: photos.length + i === 0, classification: "frontal" }).select().single();
        if (error) throw error;
        const { data: signed } = await supabase.storage.from("dress-images").createSignedUrl(path, 60 * 60);
        const photo = { ...data, signed_url: signed?.signedUrl ?? null };
        setPhotos((p) => [...p, photo]);
        setPreviewPhotoId((current) => current ?? data.id);
      }
      clearError("photos");
      setMessage("Fotografías subidas.");
    } catch (e: any) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function makePrimary(photoId: string) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("set_own_dress_primary_photo", { p_photo_id: photoId });
      if (error) throw error;
      setPhotos((current) => current.map((photo) => ({ ...photo, is_primary: photo.id === photoId })));
      setPreviewPhotoId(photoId);
      setMessage("Foto principal actualizada.");
    } catch (e: any) { setMessage(friendlyError(e)); }
    finally { setBusy(false); }
  }

  async function removePhoto(photo: any) {
    if (!confirm("¿Eliminar esta fotografía de la publicación?")) return;
    setBusy(true);
    try {
      const { data: storagePath, error } = await supabase.rpc("delete_own_dress_photo", { p_photo_id: photo.id });
      if (error) throw error;
      if (storagePath) await supabase.storage.from("dress-images").remove([String(storagePath)]);
      const remaining = photos.filter((item) => item.id !== photo.id);
      setPhotos(remaining);
      setPreviewPhotoId((current) => current === photo.id ? (remaining.find((item) => item.is_primary)?.id ?? remaining[0]?.id ?? null) : current);
      setMessage("Fotografía eliminada.");
    } catch (e: any) { setMessage(friendlyError(e)); }
    finally { setBusy(false); }
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
      setStep((s) => Math.min(stepNames.length - 1, s + 1));
    } catch {}
  }

  async function submit() {
    const issues = allIssues();
    if (issues.length) {
      applyIssues(issues);
      setMessage(`La publicación aún no está completa. Falta: ${issues.map((issue) => issue.label).join(", ")}.`);
      return;
    }
    setBusy(true);
    try {
      const id = await save({ silent: true });

      const persistedIssues = await validateSavedDress(id);
      if (persistedIssues.length) {
        applyIssues(persistedIssues);
        setStep(persistedIssues[0].step);
        setMessage(`No pudimos enviarlo a revisión porque faltan datos guardados: ${persistedIssues.map((issue) => issue.label).join(", ")}.`);
        return;
      }

      const { error: declarationError } = await supabase.from("dress_declarations").upsert({
        dress_id: id,
        seller_id: userId,
        authenticity_declared: decl.authentic,
        photos_correspond_declared: decl.photos,
        right_to_sell_declared: decl.right,
        information_true_declared: decl.trueInfo,
        promotional_image_license_declared: decl.promotionalImages,
        promotional_image_license_declared_at: decl.promotionalImages ? new Date().toISOString() : null,
        terms_version: TERMS_VERSION,
        declared_at: new Date().toISOString(),
      }, { onConflict: "dress_id" });
      if (declarationError) throw declarationError;

      // La publicación se vuelve visible de inmediato. Una marca sugerida
      // y aún pendiente de revisión NO detiene la publicación; solo el
      // nombre de marca se corrige/confirma después.
      const { error } = await supabase.rpc("submit_dress_for_review", { p_dress_id: id });
      if (error) {
        if (String(error.message || "").includes("dresses_completa_antes_de_revision")) {
          const latestIssues = await validateSavedDress(id);
          if (latestIssues.length) {
            applyIssues(latestIssues);
            setStep(latestIssues[0].step);
            setMessage(`Antes de publicar completa: ${latestIssues.map((issue) => issue.label).join(", ")}.`);
            return;
          }
          setMessage("La publicación todavía tiene información obligatoria pendiente. Revisa los campos marcados con *.");
          return;
        }
        throw error;
      }
      router.push("/mis-vestidos?published=1");
      router.refresh();
    } catch (e: any) {
      setMessage(friendlyError(e));
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
      <select value={dress[name] ?? ""} onChange={(e) => set(name, e.target.value || null)} aria-invalid={Boolean(errors[name])} aria-required={requiredKeys.has(name)} required={requiredKeys.has(name)}>
        <option value="">Selecciona</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {errors[name] && <p className="field-error">{errors[name]}</p>}
    </div>;
  }

  function input(name: string, label: string, type = "text") {
    return <div className={`field ${errors[name] ? "field-invalid" : ""}`}>
      <label>{label}{requiredKeys.has(name) && <span className="required-mark"> *</span>}</label>
      <input type={type} value={dress[name] ?? ""} min={name === "year_approx" ? 1950 : undefined} max={name === "year_approx" ? 2100 : undefined} onChange={(e) => set(name, e.target.value)} aria-invalid={Boolean(errors[name])} aria-required={requiredKeys.has(name)} required={requiredKeys.has(name)} />
      {errors[name] && <p className="field-error">{errors[name]}</p>}
    </div>;
  }

  function check(name: string, label: string) {
    return <label className="check"><input type="checkbox" checked={Boolean(dress[name])} onChange={(e) => set(name, e.target.checked)} /><span>{label}</span></label>;
  }

  function stepClick(target: number) {
    if (initialDress?.id) {
      setStep(target);
      setErrors({});
      setMessage("");
      return;
    }
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
    <div className="stepper">{stepNames.map((n, i) => { const count = issuesForStep(i).length; return <button key={n} type="button" className={`${i === step ? "active" : ""} ${count ? "step-has-missing" : "step-complete"}`} onClick={() => stepClick(i)}>{i + 1}. {n}{count ? <span className="step-missing-count" aria-label={`${count} campos pendientes`}>{count}</span> : null}</button>; })}</div>
    <section className="panel">
      {initialDress?.id && pending.length > 0 && <div className="alert-info draft-resume-banner">Falta completar {pending.length} requisito{pending.length === 1 ? "" : "s"}. Sigue con {stepNames[step].toLowerCase()}.</div>}
      <h1>{initialDress?.id ? "Editar vestido" : "Publicar vestido"}</h1>
      <h2>{stepNames[step]}</h2>
      <p className="required-note"><span className="required-mark">*</span> Campo obligatorio</p>
      {Object.keys(errors).length > 0 && (
        <div className="validation-banner" role="alert">
          <strong>Revisa este paso antes de continuar.</strong>
          <ul>
            {issuesForStep(step).filter((issue) => errors[issue.key]).map((issue) => <li key={issue.key}>{issue.label}: {errors[issue.key]}</li>)}
          </ul>
        </div>
      )}
      {dress.status === "changes_requested" && dress.moderation_notes && <div className="alert-error"><strong>Cambios solicitados por SECOND VOW:</strong><p>{dress.moderation_notes}</p></div>}

      {step === 0 && <>
        <div className={`field brand-search ${errors.brand ? "field-invalid" : ""}`}>
          <label>Marca<span className="required-mark"> *</span></label>
          <input value={brandQuery} onChange={(e) => { setBrandQuery(e.target.value); setDress((d) => ({ ...d, brand_id: null, brand_suggestion_id: null, pending_brand_name: null })); clearError("brand"); }} placeholder="Empieza a escribir una marca…" aria-invalid={Boolean(errors.brand)} />
          <p className="muted">¿No aparece? Escríbela y continúa. SECOND VOW la revisará después; no necesitas esperar autorización.</p>
          <p className="brand-list-label">Selecciona una opción de la lista:</p>
          <div className="brand-suggestions" role="group" aria-label="Opciones de marca">{matches.map((b) => <button type="button" key={b.id} aria-pressed={dress.brand_id === b.id} className={dress.brand_id === b.id ? "brand-selected" : ""} onClick={() => chooseBrand(b)}><span className="brand-choice-marker" aria-hidden="true">{dress.brand_id === b.id ? "✓" : ""}</span><span>{b.name}</span><span className="brand-choice-action">{dress.brand_id === b.id ? "Seleccionada" : "Elegir"}</span></button>)}</div>
          {noBrand && <button type="button" className={`btn no-brand-option ${dress.brand_id === noBrand.id ? "no-brand-selected" : ""}`} aria-pressed={dress.brand_id === noBrand.id} disabled={busy} onClick={chooseNoBrand}><span className="brand-choice-marker" aria-hidden="true">{dress.brand_id === noBrand.id ? "✓" : ""}</span><span>Sin marca / No conozco la marca</span><span className="brand-choice-action">{dress.brand_id === noBrand.id ? "Seleccionada" : "Elegir"}</span></button>}
          {brandQuery.trim() && !exactBrand && !dress.brand_suggestion_id && !dress.pending_brand_name && <div className="brand-new"><p>No encontramos una coincidencia exacta.</p><strong>Nombre de la marca</strong><div>{brandQuery}</div><button type="button" className="btn btn-secondary" disabled={busy} onClick={suggestBrand}>Usar esta marca y continuar</button></div>}
          {(dress.brand_suggestion_id || dress.pending_brand_name) && <p className="muted">Marca: <strong>{dress.brand_suggestions?.suggested_name || brandQuery}</strong>. La revisaremos después; puedes continuar y publicar sin esperar.</p>}
          {errors.brand && <p className="field-error">{errors.brand}</p>}
        </div>
        {input("model", "Modelo")}{input("collection", "Colección")}{input("year_approx", "Año aproximado", "number")}
      </>}

      {step === 0 && <><div className="grid-2">{options("talla_etiqueta", "Talla de etiqueta", catalogs.sizes)}{options("sistema_talla", "Sistema de talla", catalogs.sizingSystems)}{input("busto_cm", "Busto (cm)", "number")}{input("cintura_cm", "Cintura (cm)", "number")}{input("cadera_cm", "Cadera (cm)", "number")}{input("largo_hombro_piso_cm", "Hombro a piso (cm)", "number")}{input("altura_persona_cm", "Altura de quien lo usó (cm)", "number")}{input("altura_tacon_cm", "Altura de tacón (cm)", "number")}</div>{check("puede_ampliarse", "Puede ampliarse")}{check("puede_reducirse", "Puede reducirse")}</>}

      {step === 0 && <><div className="grid-2"><DressShapePicker name="silueta" label="Silueta" options={catalogs.silhouettes} value={dress.silueta ?? ""} error={errors.silueta} onChange={(value) => set("silueta", value)} /><DressShapePicker name="escote" label="Escote" options={catalogs.necklines} value={dress.escote ?? ""} error={errors.escote} onChange={(value) => set("escote", value)} /><DressShapePicker name="espalda" label="Espalda" options={catalogs.backs} value={dress.espalda ?? ""} error={errors.espalda} onChange={(value) => set("espalda", value)} />{options("manga", "Manga", catalogs.sleeves)}{options("tela_principal", "Tela principal", catalogs.fabrics)}{options("tela_secundaria", "Tela secundaria", catalogs.fabrics)}{options("color_principal", "Color principal", catalogs.colors)}{input("color_forro", "Color del forro")}{options("cola", "Cola", catalogs.trains)}{input("cola_largo_cm", "Largo de cola (cm)", "number")}</div><fieldset className="filter-group"><legend>Características y detalles</legend><div className="filter-options publish-characteristics">{catalogs.characteristics.map((c) => <label key={c.id} className="filter-check"><input type="checkbox" checked={selectedCharacteristics.includes(c.id)} onChange={() => setSelectedCharacteristics((current) => current.includes(c.id) ? current.filter((x) => x !== c.id) : [...current, c.id])} /><span>{c.label}</span></label>)}</div></fieldset></>}

      {step === 1 && <>{options("condicion", "Condición", catalogs.conditions)}<div className="checks">{check("tiene_manchas", "Tiene manchas")}{check("tiene_jalones", "Tiene jalones")}{check("tiene_roturas", "Tiene roturas")}{check("dano_dobladillo", "Daño en dobladillo")}{check("falta_aplicaciones", "Faltan aplicaciones")}{check("tiene_reparaciones", "Tiene reparaciones")}{check("tiene_decoloracion", "Tiene decoloración")}</div></>}

      {step === 1 && <>{check("tuvo_ajustes", "Tuvo ajustes o alteraciones")}{check("conserva_margen_costura", "Conserva margen de costura")}</>}

      {step === 2 && <><div className="grid-2">{input("precio_original_mxn", "Precio original (MXN)", "number")}{input("precio_venta_mxn", "Precio de venta (MXN)", "number")}</div></>}
      {step === 1 && <div className="field"><label htmlFor="dress-description">Descripción, daños, imperfecciones y ajustes</label><textarea id="dress-description" rows={7} value={dress.descripcion ?? ""} onChange={(e) => set("descripcion", e.target.value)} placeholder="Describe aquí el estado del vestido, cualquier daño o imperfección, los ajustes realizados y los detalles o accesorios incluidos." /></div>}
      {step === 2 && <><div className={`field ${errors.photos ? "field-invalid" : ""}`}><label>Fotografías (mínimo 1)<span className="required-mark"> *</span></label><input type="file" accept="image/*" multiple onChange={(e) => upload(e.target.files)} />{errors.photos && <p className="field-error">{errors.photos}</p>}<p className="muted">Agrega fotos de frente, espalda, etiqueta y cualquier daño.</p></div>{photos.length > 0 && <div className="photo-editor"><div className="photo-editor-preview"><Image width={900} height={1200} src={dressImageUrl((photos.find((p) => p.id === previewPhotoId) ?? photos[0]).storage_path, (photos.find((p) => p.id === previewPhotoId) ?? photos[0]).signed_url)} alt="Vista previa de la fotografía seleccionada" /></div><div className="photo-list">{photos.map((p, i) => <article key={p.id} className={p.id === previewPhotoId ? "photo-editor-selected" : ""}><button type="button" className="photo-thumb-button" onClick={() => setPreviewPhotoId(p.id)} aria-label={`Ver fotografía ${i + 1} en grande`}><Image width={180} height={240} src={dressImageUrl(p.storage_path, p.signed_url)} alt={`Fotografía ${i + 1}`} /></button><strong>Foto {i + 1}{p.is_primary ? " · principal" : ""}</strong><div className="photo-editor-actions">{!p.is_primary && <button type="button" className="link-button" disabled={busy} onClick={() => makePrimary(p.id)}>Hacer principal</button>}<button type="button" className="link-button danger-link" disabled={busy} onClick={() => removePhoto(p)}>Eliminar</button></div></article>)}</div></div>}</>}

      {step === 3 && <div className="publish-declarations">
        <div className={pendingByStep.length ? "review-summary review-summary-pending" : "review-summary review-summary-complete"}>
          <h3>{pendingByStep.length ? "Antes de enviar, completa lo siguiente:" : "Publicación completa"}</h3>
          {pendingByStep.length ? pendingByStep.map((group) => <div className="review-summary-step" key={group.index}><button type="button" onClick={() => setStep(group.index)}>{group.index + 1}. {group.name}</button><ul>{group.items.map((issue) => <li key={issue.key}>{issue.label}: {issue.message}</li>)}</ul></div>) : <p>Ya completaste los datos obligatorios. Tu vestido se publicará en cuanto confirmes las declaraciones.</p>}
        </div>
        {missingRecommendations().length > 0 && <div className="review-summary review-summary-recommend"><h3>Recomendado, no obligatorio</h3><p>Completar {missingRecommendations().join(", ")} ayuda a que tu vestido inspire más confianza, pero no es necesario para publicarlo.</p></div>}
        <p>Antes de publicar confirma lo siguiente:</p>
        <label className={`check ${errors.decl_authentic ? "check-invalid" : ""}`}><input type="checkbox" checked={decl.authentic} onChange={(e) => { setDecl((d) => ({ ...d, authentic: e.target.checked })); clearError("decl_authentic"); }} /><span>Declaro bajo protesta que el vestido es auténtico y no una falsificación.</span></label>
        <label className={`check ${errors.decl_photos ? "check-invalid" : ""}`}><input type="checkbox" checked={decl.photos} onChange={(e) => { setDecl((d) => ({ ...d, photos: e.target.checked })); clearError("decl_photos"); }} /><span>Declaro que las fotografías corresponden al vestido anunciado.</span></label>
        <label className={`check ${errors.decl_right ? "check-invalid" : ""}`}><input type="checkbox" checked={decl.right} onChange={(e) => { setDecl((d) => ({ ...d, right: e.target.checked })); clearError("decl_right"); }} /><span>Declaro que soy propietaria o tengo derecho para venderlo.</span></label>
        <label className={`check ${errors.decl_true ? "check-invalid" : ""}`}><input type="checkbox" checked={decl.trueInfo} onChange={(e) => { setDecl((d) => ({ ...d, trueInfo: e.target.checked })); clearError("decl_true"); }} /><span>Declaro que la información publicada es verdadera y completa respecto de los aspectos relevantes.</span></label>
        <label className="check"><input type="checkbox" checked={decl.promotionalImages} onChange={(e) => setDecl((d) => ({ ...d, promotionalImages: e.target.checked }))} /><span><strong>Opcional:</strong> autorizo a SECOND VOW a usar las fotografías de esta publicación en redes sociales y publicidad para promocionar el marketplace y este vestido. Declaro contar con los derechos y permisos de las personas que aparezcan. Puedo retirar esta autorización para usos futuros contactando a SECOND VOW.</span></label>
        <p className="muted">Estas declaraciones se registran con fecha y versión de los Términos y Condiciones.</p>
      </div>}

      {message && <div className={/(guardad|subid|enviad|actualizad|eliminad)/i.test(message) ? "alert-success" : "alert-error"}>{message}</div>}
      <div className="wizard-actions">
        <button className="btn btn-secondary" disabled={step === 0 || busy} onClick={() => { setStep((s) => s - 1); setErrors({}); setMessage(""); }}>Anterior</button>
        <p className={`autosave-status ${saveState === "error" ? "autosave-error" : ""}`} role="status" aria-live="polite">{!dress.id ? "Completa el primer paso y pulsa Siguiente para guardar tu borrador." : saveState === "saving" ? "Guardando cambios…" : saveState === "error" ? "No se guardaron los últimos cambios." : snapshot !== savedSnapshot.current ? "Cambios pendientes de guardar…" : "Borrador guardado · guardado automático activo"}</p>
        {saveState === "error" && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void save().catch(() => undefined)}>Reintentar guardado</button>}
        {step < stepNames.length - 1 ? (
          <button className="btn btn-primary" disabled={busy} onClick={nextStep}>Siguiente</button>
        ) : (
          <button className="btn btn-primary" disabled={busy || pending.length > 0} onClick={submit} title={pending.length ? "Completa todos los requisitos obligatorios antes de publicar." : undefined}>
            {dress.status === "changes_requested" ? "Reenviar y publicar" : "Publicar vestido"}
          </button>
        )}
      </div>
    </section>
  </div>;
}
