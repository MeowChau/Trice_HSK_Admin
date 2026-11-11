"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { apiFetch, API_BASE_URL, readApiError } from "@/lib/api";
import { resolveFileUrl } from "@/lib/media-url";
import { errorMessage } from "@/lib/error-message";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import { BoltIcon, CheckCircleIcon, GroupIcon, ShootingStarIcon } from "@/icons";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { GAME_RANKING_DESCRIPTIONS, gameLeaderboardDate, gameLeaderboardPath, type GameLeaderboardData, type GameLeaderboardQuery } from "@/lib/game-leaderboard";

const initialQuery: GameLeaderboardQuery = { page: 1, limit: 20, hskLevel: "", timeframe: "all", metric: "score", search: "" };
const number = (value: number) => value.toLocaleString("vi-VN");
const control = "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

function PlayerAvatar({ path, name }: { path?: string; name: string }) {
  const url = resolveFileUrl(path, API_BASE_URL);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return url && failedUrl !== url
    ? <Image src={url} alt="" width={40} height={40} unoptimized onError={() => setFailedUrl(url)} className="h-10 w-10 shrink-0 rounded-full object-cover" />
    : <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">{Array.from(name.trim())[0]?.toUpperCase() || "?"}</span>;
}

export default function GameLeaderboard() {
  const requests = useLatestRequest();
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<GameLeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const fetchLeaderboard = useCallback(async () => {
    const request = requests.start();
    setLoading(true);
    setFetchError("");
    setData(null);
    try {
      const response = await apiFetch(gameLeaderboardPath(query), { signal: request.signal, cache: "no-store" });
      if (response.status === 403) throw new Error("Bạn cần quyền quản trị viên để xem bảng xếp hạng PK.");
      if (!response.ok) throw new Error(await readApiError(response));
      const json: GameLeaderboardData = await response.json();
      if (!request.isCurrent()) return;
      if (!Array.isArray(json.leaderboard) || !json.summary || typeof json.total !== "number") throw new Error("Dữ liệu bảng xếp hạng chưa hợp lệ. Vui lòng thử lại.");
      if (json.totalPages > 0 && query.page > json.totalPages) {
        setQuery(current => ({ ...current, page: json.totalPages }));
        return;
      }
      setData(json);
    } catch (cause) {
      if (request.isCurrent()) setFetchError(errorMessage(cause, "Không tải được bảng xếp hạng PK. Vui lòng thử lại."));
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [query, requests]);

  useEffect(() => { void fetchLeaderboard(); }, [fetchLeaderboard]);
  const updateFilter = (patch: Partial<GameLeaderboardQuery>) => setQuery(current => ({ ...current, ...patch, page: 1 }));
  const metrics = [
    { label: "Người chơi", value: data?.summary.totalPlayers, Icon: GroupIcon },
    { label: "Trận đã kết thúc", value: data?.summary.totalMatches, Icon: ShootingStarIcon },
    { label: "Trận hòa", value: data?.summary.totalDraws, Icon: CheckCircleIcon },
    { label: "EXP từ PK", value: data?.summary.totalExp, Icon: BoltIcon },
  ];

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400"><ShootingStarIcon className="h-6 w-6" aria-hidden="true" /></span>
        <div><h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Bảng xếp hạng Game Online (PvP)</h1><p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">Theo dõi thành tích đấu PK 1v1 từ các trận đã kết thúc trên web và app.</p></div>
      </div>
      <Button size="sm" variant="outline" disabled={loading} onClick={() => void fetchLeaderboard()}>{loading ? "Đang tải…" : "Làm mới"}</Button>
    </div>

    <form className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]" onSubmit={event => { event.preventDefault(); updateFilter({ search }); }}>
      <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1.5fr)_minmax(9rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)]">
        <div className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"><label htmlFor="pk-player-search">Tìm học viên</label><input id="pk-player-search" type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={500} placeholder="Tên, email hoặc mã học viên" className={control} /></div>
        <div className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"><label htmlFor="pk-hsk-level">HSK thi đấu</label><select id="pk-hsk-level" value={query.hskLevel} onChange={event => updateFilter({ hskLevel: event.target.value })} className={control}><option value="">Tất cả cấp độ</option>{Array.from({ length: 9 }, (_, index) => <option key={index} value={index + 1}>HSK {index + 1}</option>)}</select></div>
        <div className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"><label htmlFor="pk-timeframe">Khoảng thời gian</label><select id="pk-timeframe" value={query.timeframe} onChange={event => updateFilter({ timeframe: event.target.value as GameLeaderboardQuery["timeframe"] })} className={control}><option value="all">Toàn bộ thời gian</option><option value="week">7 ngày gần nhất</option><option value="month">Tháng này</option></select></div>
        <div className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"><label htmlFor="pk-ranking-metric">Xếp hạng theo</label><select id="pk-ranking-metric" value={query.metric} onChange={event => updateFilter({ metric: event.target.value as GameLeaderboardQuery["metric"] })} className={control}><option value="score">Tổng điểm PK</option><option value="wins">Số trận thắng</option><option value="winRate">Tỷ lệ thắng</option></select></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3"><Button type="submit" size="sm">Tìm kiếm</Button><Button size="sm" variant="outline" onClick={() => { setSearch(""); setQuery({ ...initialQuery }); }}>Đặt lại</Button></div>
    </form>

    {fetchError && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400 sm:flex-row sm:items-center sm:justify-between"><p>{fetchError}</p><Button size="sm" variant="outline" onClick={() => void fetchLeaderboard()}>Thử lại</Button></div>}

    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-busy={loading}>
      {metrics.map(({ label, value, Icon }) => <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:p-5"><span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"><Icon className="h-5 w-5" aria-hidden="true" /></span><p className="text-sm text-gray-500 dark:text-gray-400">{label}</p><p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{value === undefined ? "—" : number(value)}</p></div>)}
    </div>

    <section className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]" aria-labelledby="game-ranking-heading" aria-busy={loading}>
      <div className="flex flex-col gap-2 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between"><h2 id="game-ranking-heading" className="text-lg font-semibold text-gray-800 dark:text-white/90">Thành tích người chơi {data && <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">{number(data.total)} kết quả</span>}</h2>{data && <p className="text-xs text-gray-500 dark:text-gray-400">Cập nhật {gameLeaderboardDate(data.generatedAt)}</p>}</div>
      <p className="px-5 py-3 text-xs leading-5 text-gray-500 dark:text-gray-400">{GAME_RANKING_DESCRIPTIONS[query.metric]}</p>
      <div className="max-w-full overflow-x-auto">
        <Table className="min-w-[1140px] text-left">
          <caption className="sr-only">Thành tích PK theo cấp HSK thi đấu và khoảng thời gian đã chọn</caption>
          <TableHeader className="border-y border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/30"><TableRow>{["Hạng", "Học viên", "HSK hiện tại", "Điểm PK", "Thắng / Hòa / Thua", "Tỷ lệ thắng", "Chuỗi thắng", "EXP PK", "Trận gần nhất"].map(label => <TableCell key={label} isHeader scope="col" className="whitespace-nowrap px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</TableCell>)}</TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={9} className="px-5 py-14 text-center text-sm text-gray-500 dark:text-gray-400"><span role="status">Đang tải bảng xếp hạng PK…</span></TableCell></TableRow>
              : data && data.leaderboard.length ? data.leaderboard.map(player => <TableRow key={player.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.02]">
                <TableCell className="px-5 py-4"><span className={"inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold " + (player.rank <= 3 ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" : "text-gray-500 dark:text-gray-400")}>{player.rank}</span></TableCell>
                <TableCell className="px-5 py-4"><div className="flex min-w-52 items-center gap-3"><PlayerAvatar path={player.photo?.path} name={player.fullName} /><div className="min-w-0"><p className="max-w-60 break-words text-sm font-semibold text-gray-800 dark:text-white/90">{player.fullName}</p><p className="mt-1 max-w-60 truncate text-xs text-gray-500 dark:text-gray-400">{player.email || "Chưa có email"}</p>{player.studentCode != null && <p className="mt-0.5 text-xs text-gray-400">Mã: {player.studentCode}</p>}</div></div></TableCell>
                <TableCell className="px-5 py-4">{player.currentHskLevel ? <Badge color="primary" size="sm">HSK {player.currentHskLevel}</Badge> : <span className="text-xs text-gray-500">Chưa đặt</span>}</TableCell>
                <TableCell className="px-5 py-4 text-sm font-semibold text-brand-600 dark:text-brand-400">{number(player.totalScore)}</TableCell>
                <TableCell className="px-5 py-4"><p className="whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-300"><span className="text-success-600 dark:text-success-400">{player.wins}</span> / {player.draws} / <span className="text-error-600 dark:text-error-400">{player.losses}</span></p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{number(player.totalMatches)} trận</p></TableCell>
                <TableCell className="px-5 py-4"><p className="text-sm font-semibold text-gray-800 dark:text-white/90">{player.winRate.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</p></TableCell>
                <TableCell className="px-5 py-4"><p className="whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{player.currentWinStreak} hiện tại</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tốt nhất: {player.longestWinStreak}</p></TableCell>
                <TableCell className="px-5 py-4 text-sm font-medium text-gray-800 dark:text-white/90">+{number(player.totalExp)}</TableCell>
                <TableCell className="whitespace-nowrap px-5 py-4 text-xs text-gray-500 dark:text-gray-400">{gameLeaderboardDate(player.lastPlayedAt)}</TableCell>
              </TableRow>)
                : <TableRow><TableCell colSpan={9} className="px-5 py-14 text-center"><p className="text-sm font-semibold text-gray-800 dark:text-white/90">{fetchError ? "Chưa tải được bảng xếp hạng" : query.search ? "Không tìm thấy học viên phù hợp" : "Chưa có trận PK đã kết thúc"}</p><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{fetchError ? "Vui lòng thử tải lại dữ liệu." : "Thử đổi bộ lọc hoặc quay lại sau khi người chơi hoàn thành trận đấu."}</p></TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {data && data.total > 0 && <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between"><p>Hiển thị {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} / {number(data.total)} học viên</p><div className="flex items-center gap-3"><Button size="sm" variant="outline" disabled={query.page <= 1 || loading} onClick={() => setQuery(current => ({ ...current, page: current.page - 1 }))}>Trước</Button><span className="whitespace-nowrap">{data.page} / {data.totalPages}</span><Button size="sm" variant="outline" disabled={query.page >= data.totalPages || loading} onClick={() => setQuery(current => ({ ...current, page: current.page + 1 }))}>Sau</Button></div></div>}
    </section>

    <details className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400"><summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">Cách tính thành tích PK</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-6"><li>Tổng điểm và EXP lấy từ kết quả trận đấu đã lưu; không cộng lại điểm danh hay EXP của hoạt động khác.</li><li>Tổng trận, trận hòa và EXP gồm cả lịch sử của tài khoản đã xóa. Danh sách xếp hạng và số người chơi chỉ gồm tài khoản chưa bị xóa.</li><li>Tỷ lệ thắng = số trận thắng / tổng số trận tham gia. Trận hòa vẫn được tính trong tổng số trận.</li><li>Chuỗi thắng tính trong phạm vi bộ lọc; hòa hoặc thua sẽ ngắt chuỗi. Trận bỏ cuộc có kết quả vẫn được tính; trận hủy chưa có kết quả không tính.</li><li>Bộ lọc HSK áp dụng cho cấp của trận đấu. Cột HSK hiện tại lấy từ hồ sơ học viên.</li><li>Hạng tính trước khi tìm kiếm nên không đổi khi tìm tên một học viên. Thời gian hiển thị theo giờ Việt Nam.</li></ul></details>
  </div>;
}
