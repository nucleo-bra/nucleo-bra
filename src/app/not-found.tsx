import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="grid min-h-dvh place-items-center bg-fundo px-4">
      <div className="w-full max-w-md rounded-[20px] border border-linha bg-white p-6 text-center">
        <h1 className="font-display text-[19px] font-bold">Página não encontrada</h1>
        <p className="mt-1.5 text-[14px] text-suave">O endereço pode ter mudado ou o link está incompleto.</p>
        <Link href="/" className="mt-5 inline-block rounded-xl bg-azul px-4 py-2 text-[14px] font-semibold text-white">Ir para o Painel</Link>
      </div>
    </div>
  );
}
