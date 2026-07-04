import CategoryForm from "../CategoryForm";

export default function NewCategoryPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Add Category</h1>
      <CategoryForm />
    </div>
  );
}