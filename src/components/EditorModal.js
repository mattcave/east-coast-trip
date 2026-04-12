"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Pencil, Trash2, MapPin, LogOut } from "lucide-react";
import { PIN_ICONS } from "@/lib/icons";

const EMPTY_FORM = {
  label: "",
  description: "",
  icon: "default",
  image: "",
  lngLat: null,
  wikipedia: null, // null = auto-detect, "none" = disabled, URL string = specific article
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 10 * 1024 * 1024;

function IconPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {Object.entries(PIN_ICONS).map(([key, { icon: Icon, label }]) => (
        <button
          key={key}
          type="button"
          title={label}
          onClick={() => onChange(key)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
            value === key
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 hover:border-gray-300 text-gray-600"
          }`}
        >
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function LocationSearch({ onSelect }) {
  const [q, setQ] = useState("");
  const [placeResults, setPlaceResults] = useState([]);
  const [wikiResults, setWikiResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setPlaceResults([]);
      setWikiResults([]);
      setOpen(false);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => { setPlaceResults(data); setOpen(true); })
        .catch(() => {});
      fetch(`/api/wikipedia/search?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => { setWikiResults(data); setOpen(true); })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [q]);

  const select = (lngLat, prefill = {}) => {
    setQ("");
    setPlaceResults([]);
    setWikiResults([]);
    setOpen(false);
    onSelect(lngLat, prefill);
  };

  const hasResults = placeResults.length > 0 || wikiResults.length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search places or Wikipedia…"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
      />
      {open && hasResults && (
        <div className="absolute z-50 left-0 right-0 bg-white rounded-lg shadow-lg border border-gray-200 mt-1 max-h-64 overflow-y-auto">
          {wikiResults.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 tracking-wider">WIKIPEDIA</div>
              {wikiResults.map((r) => (
                <button
                  key={r.url}
                  type="button"
                  // Pass lngLat only when the article has coordinates; otherwise just prefill the URL
                  onClick={() => select(r.lat !== null ? { lng: r.lng, lat: r.lat } : null, { label: r.title, wikipedia: r.url })}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                >
                  <div className="text-sm font-medium text-gray-800">{r.title}</div>
                  {r.extract && <div className="text-xs text-gray-500 truncate">{r.extract}</div>}
                </button>
              ))}
            </>
          )}
          {placeResults.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 tracking-wider">PLACES</div>
              {placeResults.map((r) => (
                <button
                  key={r.properties.id}
                  type="button"
                  onClick={() => select({ lng: r.geometry.coordinates[0], lat: r.geometry.coordinates[1] })}
                  className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                >
                  {r.properties.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PinForm({ initial, onSave, onCancel, onPickLocation, onFlyTo }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  // pendingFile holds the File selected by the user but not yet uploaded.
  // A local object URL is generated for preview without a server round-trip.
  // The actual upload happens on submit, just before the pin is saved.
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(initial?.image ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [wikiThumb, setWikiThumb] = useState(null);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  // When a Wikipedia URL is set, fetch its thumbnail to offer as a quick image option
  useEffect(() => {
    const url = form.wikipedia;
    if (!url || url === "none") { setWikiThumb(null); return; }
    fetch(`/api/wikipedia?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setWikiThumb(data?.thumbnail ?? null))
      .catch(() => {});
  }, [form.wikipedia]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) { setError("Invalid file type. Allowed: JPEG, PNG, WebP, GIF"); return; }
    if (file.size > MAX_BYTES) { setError("File too large. Maximum size is 10MB"); return; }
    setError(null);
    setPendingFile(file);
    // Revoke any previous object URL to avoid memory leaks
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.lngLat) { setError("Please pick a location on the map."); return; }

    setSaving(true);
    setError(null);

    // Upload the pending image first, then save the pin with the returned URL
    let imageUrl = form.image;
    if (pendingFile) {
      const fd = new FormData();
      fd.append("file", pendingFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) {
        setError("Image upload failed. Please try again.");
        setSaving(false);
        return;
      }
      ({ url: imageUrl } = await uploadRes.json());
    }

    const isNew = !initial?.id;
    const url = isNew ? "/api/pins" : `/api/pins/${initial.id}`;
    const method = isNew ? "POST" : "PATCH";

    // Normalize lngLat to [lng, lat] array for consistent storage.
    // Map clicks produce a MapLibre LngLat object {lat, lng}; loaded pins are already arrays.
    const lngLat = Array.isArray(form.lngLat)
      ? form.lngLat
      : [form.lngLat.lng, form.lngLat.lat];

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, lngLat, image: imageUrl }),
    });

    if (!res.ok) {
      setError("Failed to save. Please try again.");
      setSaving(false);
      return;
    }

    onSave();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
        <LocationSearch
          onSelect={(lngLat, prefill = {}) => {
            // lngLat may be null for Wikipedia articles without coordinates
            if (lngLat) { set("lngLat", lngLat); onFlyTo?.(lngLat); }
            // Only prefill label if the field is currently empty (don't clobber edits)
            if (prefill.label && !form.label) set("label", prefill.label);
            if (prefill.wikipedia !== undefined) set("wikipedia", prefill.wikipedia);
          }}
        />
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm text-gray-500 flex-1">
            {form.lngLat
              ? (() => {
                  // lngLat may be a MapLibre LngLat object {lat,lng} (from map click)
                  // or a plain array [lng, lat] (from pins.json storage)
                  const lat = form.lngLat.lat ?? form.lngLat[1];
                  const lng = form.lngLat.lng ?? form.lngLat[0];
                  return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°W`;
                })()
              : "Not set"}
          </span>
          <button
            type="button"
            onClick={() => onPickLocation((lngLat, prefill = {}) => {
              set("lngLat", lngLat);
              if (prefill.label && !form.label) set("label", prefill.label);
              if (prefill.wikipedia !== undefined) set("wikipedia", prefill.wikipedia);
            }, initial?.id)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors"
          >
            <MapPin size={14} />
            Pick on map
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
        <input
          required
          value={form.label}
          onChange={(e) => set("label", e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Peggy's Cove"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="A short description…"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Icon</label>
        <IconPicker value={form.icon} onChange={(v) => set("icon", v)} />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Image</label>
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-36 object-cover rounded-lg mb-2"
          />
        )}
        {/* Wikipedia thumbnail suggestion — shown when a Wikipedia article is linked and no image is set yet */}
        {wikiThumb && !previewUrl && (
          <div className="mb-2">
            <img src={wikiThumb} alt="Wikipedia" className="w-full h-36 object-cover rounded-lg mb-1.5 opacity-60" />
            <button
              type="button"
              onClick={() => {
                set("image", wikiThumb);
                setPreviewUrl(wikiThumb);
                setPendingFile(null);
              }}
              className="w-full text-center text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg py-1.5 transition-colors"
            >
              Use Wikipedia photo
            </button>
          </div>
        )}
        <label className="flex items-center justify-center gap-2 w-full border border-dashed border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-600 rounded-lg py-2 text-sm cursor-pointer transition-colors">
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
          {previewUrl ? "Replace image" : "Upload your own"}
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Wikipedia</label>
        <div className="flex gap-1 mb-2">
          {[
            { key: "auto",   label: "Auto" },
            { key: "none",   label: "None" },
            { key: "custom", label: "Custom" },
          ].map(({ key, label }) => {
            const current = form.wikipedia === null ? "auto"
              : form.wikipedia === "none" ? "none"
              : "custom";
            return (
              <button
                key={key}
                type="button"
                onClick={() => set("wikipedia",
                  key === "auto" ? null : key === "none" ? "none" : ""
                )}
                className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                  current === key
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {form.wikipedia !== null && form.wikipedia !== "none" && (
          <input
            type="url"
            value={form.wikipedia}
            onChange={(e) => set("wikipedia", e.target.value)}
            placeholder="https://en.wikipedia.org/wiki/…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        {form.wikipedia === null && (
          <p className="text-xs text-gray-400">Nearest article will be found automatically.</p>
        )}
        {form.wikipedia === "none" && (
          <p className="text-xs text-gray-400">No Wikipedia link will be shown.</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {saving ? "Saving…" : initial?.id ? "Save changes" : "Add pin"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function EditorModal({ pins, onClose, onStartPlacement, onRefresh, onFlyTo, editTargetId, onEditTargetConsumed }) {
  const [view, setView] = useState("list"); // 'list' | 'form'
  const [editingPin, setEditingPin] = useState(null);
  const scrollRef = useRef(null);

  // When a popup Edit button sets an editTargetId, jump straight to that pin's form
  useEffect(() => {
    if (!editTargetId) return;
    const pin = pins.find((p) => p.id === editTargetId);
    if (pin) openEdit(pin);
    onEditTargetConsumed?.();
  }, [editTargetId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [deletingId, setDeletingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const scrollToTop = () => { if (scrollRef.current) scrollRef.current.scrollTop = 0; };

  const openAdd = () => { setEditingPin(null); setView("form"); scrollToTop(); };
  const openEdit = (pin) => { setEditingPin(pin); setView("form"); scrollToTop(); onFlyTo?.(pin.lngLat); };
  const backToList = () => { setEditingPin(null); setView("list"); scrollToTop(); };

  const handleSave = async () => {
    await onRefresh();
    backToList();
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    onClose();
    router.refresh();
  };

  const confirmDelete = async () => {
    setDeleting(true);
    await fetch(`/api/pins/${deletingId}`, { method: "DELETE" });
    setDeletingId(null);
    setDeleting(false);
    await onRefresh();
  };

  return (
    <div className="absolute top-0 right-0 h-full w-full sm:w-80 bg-white shadow-2xl flex flex-col z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {view === "form" && (
            <button onClick={backToList} className="text-gray-400 hover:text-gray-600 text-sm">
              ←
            </button>
          )}
          <h2 className="font-semibold text-gray-800 text-sm">
            {view === "list" ? "Edit Pins" : editingPin ? "Edit Pin" : "Add Pin"}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={logout} title="Sign out" className="text-gray-400 hover:text-gray-600 p-1">
            <LogOut size={16} />
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {view === "list" && (
          <>
            <button
              onClick={openAdd}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-blue-400 text-gray-500 hover:text-blue-600 rounded-lg py-2.5 text-sm font-medium mb-4 transition-colors"
            >
              <Plus size={16} /> Add new pin
            </button>

            <div className="flex flex-col gap-2">
              {pins.map((pin) => {
                const { icon: Icon, color } = PIN_ICONS[pin.icon] ?? PIN_ICONS.default;
                return (
                  <div key={pin.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: color }}>
                      <Icon size={14} color="white" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{pin.label}</span>

                    {deletingId === pin.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Delete?</span>
                        <button
                          onClick={confirmDelete}
                          disabled={deleting}
                          className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(pin)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingId(pin.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {view === "form" && (
          <PinForm
            initial={editingPin}
            onSave={handleSave}
            onCancel={backToList}
            onPickLocation={onStartPlacement}
            onFlyTo={onFlyTo}
          />
        )}
      </div>
    </div>
  );
}
