"use client";

import ArticleManager, { type ArticleConfig } from "@/components/admin/ArticleManager";

const CONFIG: ArticleConfig = {
  endpoint: "/posts",
  publicSection: "guide",
  queryKey: "posts",
  kind: "post",
  title: "Аяллын зөвлөгөө",
  description:
    "Виз, ачаа тээш, аялалд бэлдэх тухай нийтлэлүүд. Сайтын «Зөвлөгөө» хэсэгт харагдана. Ноорогоор хадгалаад, бэлэн болохоор нь нийтэлнэ.",
  noun: "нийтлэл",
  deleteTitle: "Энэ нийтлэлийг устгах уу?",
  addLabel: "Нийтлэл бичих",
  emptyTitle: "Нийтлэл хараахан алга",
  emptyDescription: "Аялагчдын байнга асуудаг зүйлийг (виз, ачаа, валют) нийтлэл болгож бичвэл утсаар асуух нь багасна.",
  titlePlaceholder: "ж: Японы виз мэдүүлэхэд бүрдүүлэх бичиг баримт",
};

export default function PostsClient() {
  return <ArticleManager config={CONFIG} />;
}
