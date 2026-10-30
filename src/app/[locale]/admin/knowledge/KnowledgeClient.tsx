"use client";

import ArticleManager, { type ArticleConfig } from "@/components/admin/ArticleManager";

const CONFIG: ArticleConfig = {
  endpoint: "/knowledge",
  publicSection: "discover",
  queryKey: "knowledge",
  kind: "knowledge",
  title: "Танин мэдэхүй",
  description:
    "Сонирхолтой баримт, зураг, бичлэг — жишээ нь «Хятадын Их хэрэм хэр урт вэ». Сайтын «Танин мэдэхүй» хэсэгт харагдана. Ноорогоор хадгалаад, бэлэн болохоор нь нийтэлнэ.",
  noun: "мэдээлэл",
  deleteTitle: "Энэ мэдээллийг устгах уу?",
  addLabel: "Мэдээлэл нэмэх",
  emptyTitle: "Мэдээлэл хараахан алга",
  emptyDescription: "Очих газруудын тухай сонирхолтой баримт нэмбэл сайтад орсон хүмүүс удаан үлдэж, аялал сонирхоно.",
  titlePlaceholder: "ж: Хятадын Их хэрэм",
};

export default function KnowledgeClient() {
  return <ArticleManager config={CONFIG} />;
}
