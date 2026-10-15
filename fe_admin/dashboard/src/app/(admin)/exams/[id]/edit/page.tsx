"use client";
import { useParams } from "next/navigation";
import ExamEditor from "@/components/exams/ExamEditor";

export default function ExamEditPage() {
  const { id } = useParams<{ id: string }>();
  return <ExamEditor key={id} id={id} />;
}
