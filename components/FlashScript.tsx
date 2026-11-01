// Mensaje flash: el servidor lo renderiza y el cliente lo borra (mostrarlo una sola vez).
export default function FlashScript() {
  return <script dangerouslySetInnerHTML={{ __html: "document.cookie='excellab_flash=; Max-Age=0; path=/'" }} />;
}
