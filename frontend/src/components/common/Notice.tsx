import type { Notice as NoticeType } from "../../types";
export function Notice({ notice }: { notice: NoticeType | null }) { return notice ? <div className={`notice ${notice.type}`} role="status">{notice.text}</div> : null; }
