export default function FieldError({ msg }: { msg?: string }) {
  return msg ? <p role="alert" className="mt-1 text-xs font-medium text-red-600">{msg}</p> : null;
}
