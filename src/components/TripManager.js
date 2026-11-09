"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { formatTripDates, sortTrips } from "@/lib/trips";

const INPUT_CLASS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function TripForm({ initial, isDefault, getMapView, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    intro: initial?.intro ?? "",
    startDate: initial?.startDate ?? "",
    endDate: initial?.endDate ?? "",
    view: initial?.view ?? null,
  });
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const useCurrentView = () => {
    const view = getMapView();
    if (view) set("view", view);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const isNew = !initial;
    const res = await fetch(isNew ? "/api/trips" : `/api/trips/${initial.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, ...(makeDefault ? { isDefault: true } : {}) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to save. Please try again.");
      setSaving(false);
      return;
    }

    const trip = await res.json();
    // POST doesn't take isDefault, so a new trip is made the default with a
    // follow-up PATCH
    if (isNew && makeDefault) {
      await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
    }
    await onSaved(trip, isNew);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
        <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={INPUT_CLASS} placeholder="West Coast Trip" />
        {initial && (
          <p className="mt-1 text-xs text-gray-400">Link: /trips/{initial.id} (stays the same if you rename)</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Short description</label>
        <input value={form.description} onChange={(e) => set("description", e.target.value)} className={INPUT_CLASS} placeholder="Vancouver to Tofino in a rented van" />
        <p className="mt-1 text-xs text-gray-400">Shown on the trip&apos;s card and in link previews.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Intro</label>
        <textarea
          value={form.intro}
          onChange={(e) => set("intro", e.target.value)}
          rows={4}
          className={`${INPUT_CLASS} resize-none`}
          placeholder="A paragraph or two welcoming visitors to this trip…"
        />
        <p className="mt-1 text-xs text-gray-400">Shown when someone first opens this trip.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
          <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
          <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={INPUT_CLASS} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Starting map view</label>
        <p className="text-sm text-gray-500 mb-2">
          {form.view ? `Saved view (zoom ${form.view.zoom})` : "Fits all of the trip's pins"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={useCurrentView}
            className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg py-1.5 transition-colors"
          >
            Use current map view
          </button>
          {form.view && (
            <button
              type="button"
              onClick={() => set("view", null)}
              className="flex-1 text-xs font-medium text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-lg py-1.5 transition-colors"
            >
              Fit pins instead
            </button>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isDefault || makeDefault}
          disabled={isDefault}
          onChange={(e) => setMakeDefault(e.target.checked)}
        />
        {isDefault ? "This is the default trip" : "Make this the default trip"}
      </label>
      <p className="-mt-3 text-xs text-gray-400">The default trip is shown behind the trip chooser on the home page.</p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Create trip"}
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

// "Trips" tab of the admin panel: create, edit, delete, and pick the default.
export default function TripManager({ trips, defaultTripId, pinsByTrip, currentTripId, getMapView, onTripsChanged }) {
  const [editing, setEditing] = useState(null); // null = list, "new", or a trip object
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const handleSaved = async (trip, isNew) => {
    await onTripsChanged();
    setEditing(null);
    // Jump to a new trip so pins can be added to it straight away. Done
    // after the refresh so TripMap already knows the trip when the URL changes.
    if (isNew) router.push(`/trips/${trip.id}`);
  };

  const confirmDelete = async () => {
    setBusy(true);
    setDeleteError(null);
    const res = await fetch(`/api/trips/${deletingId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setDeleteError(body?.error ?? "Failed to delete.");
      setBusy(false);
      return;
    }
    const wasCurrent = deletingId === currentTripId;
    setDeletingId(null);
    setBusy(false);
    await onTripsChanged();
    if (wasCurrent) router.push("/");
  };

  if (editing) {
    return (
      <>
        <button onClick={() => setEditing(null)} className="mb-3 text-sm text-gray-500 hover:text-gray-700">
          ← All trips
        </button>
        <TripForm
          initial={editing === "new" ? null : editing}
          isDefault={editing !== "new" && editing.id === defaultTripId}
          getMapView={getMapView}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setEditing("new")}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-blue-400 text-gray-500 hover:text-blue-600 rounded-lg py-2.5 text-sm font-medium mb-4 transition-colors"
      >
        <Plus size={16} /> New trip
      </button>

      <div className="flex flex-col gap-2">
        {sortTrips(trips).map((trip) => {
          const pinCount = pinsByTrip[trip.id]?.length ?? 0;
          const isDefault = trip.id === defaultTripId;
          const meta = [formatTripDates(trip), `${pinCount} ${pinCount === 1 ? "pin" : "pins"}`].filter(Boolean).join(" · ");

          return (
            <div
              key={trip.id}
              className={`p-3 rounded-lg border ${trip.id === currentTripId ? "border-blue-200 bg-blue-50/40" : "border-gray-100 hover:border-gray-200"}`}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800 truncate">{trip.name}</span>
                    {isDefault && <Star size={12} className="flex-shrink-0 fill-amber-400 text-amber-400" aria-label="Default trip" />}
                  </div>
                  <div className="text-xs text-gray-400">{meta}</div>
                </div>
                {deletingId !== trip.id && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditing(trip)} title="Edit trip" className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors">
                      <Pencil size={14} />
                    </button>
                    {/* The default trip can't be deleted (the API refuses too) */}
                    {!isDefault && (
                      <button
                        onClick={() => { setDeletingId(trip.id); setDeleteError(null); }}
                        title="Delete trip"
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {deletingId === trip.id && (
                <div className="mt-2 pt-2 border-t border-gray-100 text-sm">
                  <p className="text-gray-600">
                    {pinCount === 0
                      ? "Delete this trip? It has no pins."
                      : `Delete this trip and its ${pinCount} ${pinCount === 1 ? "pin" : "pins"}, including their photos? This can't be undone.`}
                  </p>
                  {deleteError && <p className="mt-1 text-red-600">{deleteError}</p>}
                  <div className="mt-2 flex gap-3">
                    <button onClick={confirmDelete} disabled={busy} className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50">
                      {busy ? "Deleting…" : "Delete trip"}
                    </button>
                    <button onClick={() => setDeletingId(null)} disabled={busy} className="text-gray-500 hover:text-gray-700 disabled:opacity-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
