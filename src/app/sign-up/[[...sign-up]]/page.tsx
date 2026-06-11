import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-50 via-gray-50 to-amber-50">
      <div className="relative flex flex-col items-center justify-center p-4">
        {/* Soft floating background glows */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-violet-100 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob"></div>
        <div className="absolute top-10 -right-4 w-72 h-72 bg-amber-100 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-2000"></div>
        
        <div className="relative z-10 text-center mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Next<span className="text-violet-600">Flow</span>
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Build and orchestrate advanced DAG-based LLM workflows.
          </p>
        </div>

        <div className="relative z-10 shadow-2xl rounded-2xl overflow-hidden border border-gray-100 bg-white/80 backdrop-blur-md">
          <SignUp 
            appearance={{
              elements: {
                card: "shadow-none border-none bg-transparent",
                headerTitle: "text-gray-900 font-bold",
                headerSubtitle: "text-gray-500",
                socialButtonsBlockButton: "border-gray-200 text-gray-600 hover:bg-gray-50",
                formButtonPrimary: "bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm transition-colors",
                footerActionLink: "text-violet-600 hover:text-violet-700",
              }
            }}
          />
        </div>
      </div>
    </main>
  );
}
