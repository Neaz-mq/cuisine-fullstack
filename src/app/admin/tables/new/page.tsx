import TableForm from "../TableForm";

export default function NewTablePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Add Table</h1>
      <TableForm />
    </div>
  );
}