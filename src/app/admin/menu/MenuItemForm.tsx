"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Category = { id: string; name: string };

type MenuItemFormProps = {
  categories: Category[];
  initialData?: {
    id: string;
    title: string;
    description: string;
    price: number;
    imageUrl: string | null;
    categoryId: string;
    isAvailable: boolean;
  };
};

export default function MenuItemForm({ categories, initialData }: MenuItemFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [price, setPrice] = useState(initialData?.price?.toString() ?? "");
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl ?? "");
  const [categoryId, setCategoryId] = useState(
    initialData?.categoryId ?? categories[0]?.id ?? ""
  );
  const [isAvailable, setIsAvailable] = useState(initialData?.isAvailable ?? true);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setImageUrl(data.url);
      } else {
        setError(data.error ?? "Upload failed. Please try again.");
      }
    } catch {
      setError("Upload failed. Please check your connection and try again.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedPrice = parseFloat(price);
    if (!title.trim() || !description.trim() || isNaN(parsedPrice) || !categoryId) {
      setError("Please fill in all required fields with valid values.");
      return;
    }

    startTransition(async () => {
      const body = {
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        imageUrl: imageUrl.trim() || null,
        categoryId,
        isAvailable,
      };

      const res = await fetch(
        initialData ? `/api/admin/menu-items/${initialData.id}` : "/api/admin/menu-items",
        {
          method: initialData ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        router.push("/admin/menu");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          required
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (USD)</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 8.99"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-md text-sm"
              required
            />
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            required
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={isUploading}
          className="w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-gray-100 file:text-sm file:font-medium hover:file:bg-gray-200 disabled:opacity-50"
        />
        {isUploading && <p className="text-xs text-gray-400 mt-1">Uploading...</p>}
        {imageUrl && !isUploading && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Preview"
            className="mt-2 h-24 w-24 object-cover rounded-md border border-gray-200"
          />
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
          className="rounded border-gray-300"
        />
        Available for order
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || isUploading}
          className="bg-[#FF4C15] text-white text-sm font-semibold px-5 py-2 rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving..." : initialData ? "Save Changes" : "Create Item"}
        </button>
      </div>
    </form>
  );
}