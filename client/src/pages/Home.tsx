import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Link2,
  FileText,
  Users,
  ClipboardCopy,
  Download,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import type { FormFieldMapping, ParsedStudent, StudentLink } from "@shared/types";

type Step = "input" | "verify" | "result";

export default function Home() {
  const [step, setStep] = useState<Step>("input");

  // Input state
  const [formUrl, setFormUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [tutor, setTutor] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courseTopic, setCourseTopic] = useState("");

  // Parsed state
  const [formFields, setFormFields] = useState<FormFieldMapping | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [students, setStudents] = useState<ParsedStudent[]>([]);
  const [fieldOptions, setFieldOptions] = useState<Record<string, string[]>>({});

  // Result state
  const [links, setLinks] = useState<StudentLink[]>([]);

  // Mutations
  const parseFormMutation = trpc.form.parseForm.useMutation();
  const parseTextMutation = trpc.form.parseText.useMutation();
  const generateLinksMutation = trpc.form.generateLinks.useMutation();

  const isLoading = parseFormMutation.isPending || parseTextMutation.isPending;

  const handleParseAll = useCallback(async () => {
    if (!formUrl.trim()) {
      toast.error("請輸入 Google Form 連結");
      return;
    }
    if (!pastedText.trim()) {
      toast.error("請貼上資料文字");
      return;
    }

    try {
      // Parse form and text in parallel
      const [formResult, textResult] = await Promise.all([
        parseFormMutation.mutateAsync({ url: formUrl.trim() }),
        parseTextMutation.mutateAsync({ text: pastedText.trim() }),
      ]);

      setFormFields(formResult.fields);
      setBaseUrl(formResult.baseUrl);
      setFormTitle(formResult.formTitle || "");
      setStudents(textResult.map((s) => ({ ...s, gender: s.gender || "" })));
      setFieldOptions(formResult.fieldOptions || {});
      setStep("verify");

      // Warn about missing field mappings
      const missingFields: string[] = [];
      if (!formResult.fields.studentName) missingFields.push("學生姓名");
      if (!formResult.fields.studentId) missingFields.push("學生編號");
      if (!formResult.fields.gender) missingFields.push("性別");
      if (!formResult.fields.tutor) missingFields.push("Tutor");
      if (!formResult.fields.courseId) missingFields.push("課程編號");
      if (!formResult.fields.courseTopic) missingFields.push("課程主題");

      if (missingFields.length > 0) {
        toast.warning(`部分欄位未能自動映射：${missingFields.join("、")}。這些欄位不會出現在預填連結中。`, { duration: 6000 });
      }

      toast.success(`成功解析 ${textResult.length} 筆資料`);
    } catch (err: any) {
      toast.error(err.message || "解析失敗，請檢查輸入內容");
    }
  }, [formUrl, pastedText, parseFormMutation, parseTextMutation]);

  const handleGenerateLinks = useCallback(async () => {
    if (!formFields || !baseUrl) return;

    // Validate all genders are set
    const missingGender = students.some((s) => !s.gender);
    if (missingGender) {
      toast.error("請為所有學生選擇性別");
      return;
    }

    try {
      const result = await generateLinksMutation.mutateAsync({
        baseUrl,
        fields: formFields,
        students: students.map((s) => ({
          name: s.name,
          id: s.id,
          gender: s.gender || "",
        })),
        commonData: {
          tutor: tutor || undefined,
          courseId: courseId || undefined,
          courseTopic: courseTopic || undefined,
        },
      });

      setLinks(result);
      setStep("result");
      toast.success("連結生成完成！");
    } catch (err: any) {
      toast.error(err.message || "生成連結失敗");
    }
  }, [formFields, baseUrl, students, tutor, courseId, courseTopic, generateLinksMutation]);

  const handleCopyAll = useCallback(() => {
    const text = links.map((l) => `${l.name} (${l.id}): ${l.link}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      toast.success("已複製所有連結");
    }).catch(() => {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("已複製所有連結");
    });
  }, [links]);

  const handleDownloadCsv = useCallback(() => {
    const header = "Name,ID,Gender,Link\n";
    const rows = links
      .map((l) => `"${l.name}","${l.id}","${l.gender}","${l.link}"`)
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prefill-links-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 已下載");
  }, [links]);

  const handleReset = useCallback(() => {
    setStep("input");
    setLinks([]);
    setStudents([]);
    setFormFields(null);
    setBaseUrl("");
    setFormTitle("");
    setFieldOptions({});
  }, []);

  const updateStudentGender = (index: number, gender: string) => {
    setStudents((prev) =>
      prev.map((s, i) => (i === index ? { ...s, gender } : s))
    );
  };

  const updateStudentName = (index: number, name: string) => {
    setStudents((prev) =>
      prev.map((s, i) => (i === index ? { ...s, name } : s))
    );
  };

  const updateStudentId = (index: number, id: string) => {
    setStudents((prev) =>
      prev.map((s, i) => (i === index ? { ...s, id } : s))
    );
  };

  const removeStudent = (index: number) => {
    setStudents((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/90 backdrop-blur-md sticky top-0 z-10">
        <div className="container py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm border border-primary/10">
              <Sparkles className="w-5 h-5 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Form Autofill</h1>
              <p className="text-[11px] text-muted-foreground tracking-wide">智能預填連結生成器</p>
            </div>
          </div>
          {step !== "input" && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              重新開始
            </Button>
          )}
        </div>
      </header>

      {/* Progress indicator */}
      <div className="container pt-8 pb-4">
        <div className="flex items-center gap-3 text-sm">
          <StepIndicator active={step === "input"} done={step !== "input"} label="輸入資料" num={1} />
          <div className="w-8 h-px bg-border" />
          <StepIndicator active={step === "verify"} done={step === "result"} label="核對確認" num={2} />
          <div className="w-8 h-px bg-border" />
          <StepIndicator active={step === "result"} done={false} label="生成連結" num={3} />
        </div>
      </div>

      {/* Main content */}
      <main className="container py-6">
        {step === "input" && (
          <InputStep
            formUrl={formUrl}
            setFormUrl={setFormUrl}
            pastedText={pastedText}
            setPastedText={setPastedText}
            tutor={tutor}
            setTutor={setTutor}
            courseId={courseId}
            setCourseId={setCourseId}
            courseTopic={courseTopic}
            setCourseTopic={setCourseTopic}
            onSubmit={handleParseAll}
            isLoading={isLoading}
            fieldOptions={fieldOptions}
          />
        )}

        {step === "verify" && (
          <VerifyStep
            students={students}
            formTitle={formTitle}
            tutor={tutor}
            setTutor={setTutor}
            courseId={courseId}
            setCourseId={setCourseId}
            courseTopic={courseTopic}
            setCourseTopic={setCourseTopic}
            onUpdateGender={updateStudentGender}
            onUpdateName={updateStudentName}
            onUpdateId={updateStudentId}
            onRemove={removeStudent}
            onConfirm={handleGenerateLinks}
            onBack={() => setStep("input")}
            isLoading={generateLinksMutation.isPending}
            fieldOptions={fieldOptions}
          />
        )}

        {step === "result" && (
          <ResultStep
            links={links}
            onCopyAll={handleCopyAll}
            onDownloadCsv={handleDownloadCsv}
          />
        )}
      </main>
    </div>
  );
}

// --- Sub-components ---

function StepIndicator({ active, done, label, num }: { active: boolean; done: boolean; label: string; num: number }) {
  return (
    <div className={`flex items-center gap-2 transition-all duration-300 ${active ? "text-primary font-semibold" : done ? "text-primary/70" : "text-muted-foreground/50"}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all duration-300 ${
        active ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30" : done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
      }`}>
        {done ? <CheckCircle2 className="w-3 h-3" /> : num}
      </div>
      <span className="text-[13px]">{label}</span>
    </div>
  );
}

function InputStep({
  formUrl, setFormUrl, pastedText, setPastedText,
  tutor, setTutor, courseId, setCourseId, courseTopic, setCourseTopic,
  onSubmit, isLoading, fieldOptions,
}: {
  formUrl: string; setFormUrl: (v: string) => void;
  pastedText: string; setPastedText: (v: string) => void;
  tutor: string; setTutor: (v: string) => void;
  courseId: string; setCourseId: (v: string) => void;
  courseTopic: string; setCourseTopic: (v: string) => void;
  onSubmit: () => void; isLoading: boolean;
  fieldOptions: Record<string, string[]>;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Google Form URL */}
      <Card className="p-6 shadow-sm hover:shadow-md transition-shadow duration-300 border-border/60">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
            <Link2 className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
          </div>
          <h2 className="font-semibold text-[15px]">Google Form 連結</h2>
        </div>
        <Input
          placeholder="https://docs.google.com/forms/d/e/..."
          value={formUrl}
          onChange={(e) => setFormUrl(e.target.value)}
          className="font-mono text-sm h-11"
        />
        <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
          貼入表單連結，系統將自動識別並映射各欄位
        </p>
      </Card>

      {/* Pasted text */}
      <Card className="p-6 shadow-sm hover:shadow-md transition-shadow duration-300 border-border/60">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
          </div>
          <h2 className="font-semibold text-[15px]">貼上資料</h2>
        </div>
        <Textarea
          placeholder={"TOM陳大文\n(20000234)\n\nJOHN 馮大文*\n(20211133)\n\n..."}
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          className="min-h-[180px] font-mono text-sm leading-relaxed resize-y"
        />
        <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
          直接貼上文字，AI 將自動提取英文名字與編號
        </p>
      </Card>

      {/* Common fields */}
      <Card className="p-6 shadow-sm hover:shadow-md transition-shadow duration-300 border-border/60">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
          </div>
          <h2 className="font-semibold text-[15px]">共用欄位</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Tutor</label>
            <Input
              placeholder="導師姓名"
              value={tutor}
              onChange={(e) => setTutor(e.target.value)}
              className="h-10"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">課程編號</label>
            <Input
              placeholder="e.g. ENG101"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="h-10"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">課程主題</label>
            <Input
              placeholder="e.g. Summer English"
              value={courseTopic}
              onChange={(e) => setCourseTopic(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
      </Card>

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <Button onClick={onSubmit} disabled={isLoading} size="lg" className="gap-2 px-10 h-12 text-[15px] font-semibold shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30 transition-all duration-200 active:scale-[0.97]">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              解析中...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              開始解析
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function VerifyStep({
  students, formTitle, tutor, setTutor, courseId, setCourseId, courseTopic, setCourseTopic,
  onUpdateGender, onUpdateName, onUpdateId, onRemove,
  onConfirm, onBack, isLoading, fieldOptions,
}: {
  students: ParsedStudent[];
  formTitle: string;
  tutor: string; setTutor: (v: string) => void;
  courseId: string; setCourseId: (v: string) => void;
  courseTopic: string; setCourseTopic: (v: string) => void;
  onUpdateGender: (i: number, g: string) => void;
  onUpdateName: (i: number, n: string) => void;
  onUpdateId: (i: number, id: string) => void;
  onRemove: (i: number) => void;
  onConfirm: () => void;
  onBack: () => void;
  isLoading: boolean;
  fieldOptions: Record<string, string[]>;
}) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Summary */}
      <Card className="p-5 shadow-sm border-border/60">
        <h2 className="font-semibold text-[15px] mb-4">共用欄位設定</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Tutor</label>
            {fieldOptions.tutor && fieldOptions.tutor.length > 0 ? (
              <Select value={tutor} onValueChange={setTutor}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選擇 Tutor" />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.tutor.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={tutor} onChange={(e) => setTutor(e.target.value)} placeholder="導師姓名" className="h-10" />
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">課程編號</label>
            <Input value={courseId} onChange={(e) => setCourseId(e.target.value)} placeholder="e.g. B40" className="h-10" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">課程主題</label>
            {fieldOptions.courseTopic && fieldOptions.courseTopic.length > 0 ? (
              <Select value={courseTopic} onValueChange={setCourseTopic}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="選擇課程主題" />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.courseTopic.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={courseTopic} onChange={(e) => setCourseTopic(e.target.value)} placeholder="課程主題" className="h-10" />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
          {formTitle && <Badge variant="secondary">{formTitle}</Badge>}
          {tutor && <Badge variant="outline">Tutor: {tutor}</Badge>}
          {courseId && <Badge variant="outline">課程: {courseId}</Badge>}
          {courseTopic && <Badge variant="outline">主題: {courseTopic}</Badge>}
          <Badge variant="secondary">{students.length} 位學生</Badge>
        </div>
      </Card>

      {/* Verification table */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <h2 className="font-medium">資料核對</h2>
          <p className="text-xs text-muted-foreground mt-1">請確認以下資料正確，並為每位學生選擇性別</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">#</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">英文名字</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">學生編號</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">性別</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Input
                      value={student.name}
                      onChange={(e) => onUpdateName(i, e.target.value)}
                      className="h-8 text-sm font-medium w-32"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      value={student.id}
                      onChange={(e) => onUpdateId(i, e.target.value)}
                      className="h-8 text-sm font-mono w-28"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Select value={student.gender || ""} onValueChange={(v) => onUpdateGender(i, v)}>
                      <SelectTrigger className="h-8 w-20 text-sm">
                        <SelectValue placeholder="選擇" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="他">他</SelectItem>
                        <SelectItem value="她">她</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(i)}
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    >
                      移除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          返回修改
        </Button>
        <Button onClick={onConfirm} disabled={isLoading} size="lg" className="gap-2 px-8">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              確認並生成連結
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ResultStep({
  links, onCopyAll, onDownloadCsv,
}: {
  links: StudentLink[];
  onCopyAll: () => void;
  onDownloadCsv: () => void;
}) {
  const handleCopySingle = async (link: string, name: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(`已複製 ${name} 的連結`);
    } catch {
      // Fallback: create a temporary textarea
      const textarea = document.createElement("textarea");
      textarea.value = link;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success(`已複製 ${name} 的連結`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-medium">已生成 {links.length} 個預填連結</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCopyAll} className="gap-1.5">
              <ClipboardCopy className="w-3.5 h-3.5" />
              複製全部
            </Button>
            <Button variant="outline" size="sm" onClick={onDownloadCsv} className="gap-1.5">
              <Download className="w-3.5 h-3.5" />
              下載 CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* Link cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {links.map((link, i) => (
          <Card key={i} className="p-4 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm">{link.name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{link.id}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {link.gender}
              </Badge>
            </div>
            <Separator className="mb-3" />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1.5 text-xs"
                onClick={() => window.open(link.link, "_blank")}
              >
                <ExternalLink className="w-3 h-3" />
                開啟表單
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => handleCopySingle(link.link, link.name)}
              >
                <ClipboardCopy className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
