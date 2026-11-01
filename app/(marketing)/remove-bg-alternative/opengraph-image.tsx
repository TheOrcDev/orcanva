import { renderShareImage } from "@/lib/seo/share-image";

export {
  SHARE_IMAGE_SIZE as size,
  SHARE_IMAGE_TYPE as contentType,
} from "@/lib/seo/share-image";

export const alt = "Orcanva: A free remove.bg alternative.";

const OpengraphImage = () =>
  renderShareImage({
    subtitle: "Background removal in your browser. Free, no account.",
    title: "A free remove.bg alternative.",
  });

export default OpengraphImage;
