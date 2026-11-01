import { renderShareImage } from "@/lib/seo/share-image";

export {
  SHARE_IMAGE_SIZE as size,
  SHARE_IMAGE_TYPE as contentType,
} from "@/lib/seo/share-image";

export const alt = "Orcanva: Free background remover.";

const OpengraphImage = () =>
  renderShareImage({
    subtitle: "Transparent PNGs, made in your browser. No sign-up.",
    title: "Free background remover.",
  });

export default OpengraphImage;
