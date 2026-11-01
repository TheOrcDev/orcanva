import { renderShareImage } from "@/lib/seo/share-image";

export {
  SHARE_IMAGE_SIZE as size,
  SHARE_IMAGE_TYPE as contentType,
} from "@/lib/seo/share-image";

export const alt = "Orcanva: From idea to design in minutes.";

const OpengraphImage = () =>
  renderShareImage({
    subtitle: "Every size from Story to 4K, and the tools to fill it fast.",
    title: "From idea to design in minutes.",
  });

export default OpengraphImage;
