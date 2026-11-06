import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { useStore } from "../data/store";
import { now, relTime } from "../data/selectors";
import { Button, EmptyState, ICON, Page, PageHeader, Panel, Segmented } from "../components/ui";
import { useState } from "react";

export default function Notifications() {
  const { state, actions, me } = useStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const mine = state.notifications.filter((n) => n.userId === me.id);
  const unreadCount = mine.filter((n) => !n.read).length;
  const visible = mine.filter((n) => filter === "all" || !n.read).sort((a, b) => b.at.localeCompare(a.at));
  const todayKey = new Date(now()).toDateString();
  const today = visible.filter((n) => new Date(n.at).toDateString() === todayKey);
  const earlier = visible.filter((n) => new Date(n.at).toDateString() !== todayKey);
  const openNotification = (id: string, href: string) => { actions.markRead(id); navigate(href); };
  return <Page>
    <PageHeader title="Notifications" actions={<Button variant="secondary" disabled={!unreadCount} icon={<CheckCheck size={15} strokeWidth={ICON} /> } onClick={actions.markAllRead}>Mark all as read</Button>} />
    <Panel flush>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5"><Segmented value={filter} onChange={setFilter} items={[{ id: "all", label: "All" }, { id: "unread", label: "Unread", icon: <span className="rounded-sm bg-muted px-1.5 text-xs tabular-nums">{unreadCount}</span> }]} /></div>
      {visible.length === 0 ? <EmptyState icon={<Bell size={28} strokeWidth={ICON} />} title={filter === "unread" ? "You're all caught up" : "No notifications"} body={filter === "unread" ? "There are no unread notifications." : "Notifications about your assessments and copies will appear here."} /> : <div>
        {today.length > 0 && <NotificationGroup title="Today" items={today} onOpen={openNotification} />}
        {earlier.length > 0 && <NotificationGroup title="Earlier" items={earlier} onOpen={openNotification} />}
      </div>}
    </Panel>
  </Page>;
}

function NotificationGroup({ title, items, onOpen }: { title: string; items: { id: string; href: string; title: string; body: string; at: string; read: boolean }[]; onOpen: (id: string, href: string) => void }) {
  return <section aria-label={title}>
    <h2 className="border-b border-border bg-subtle px-4 py-2 text-xs font-medium text-ink-3">{title}</h2>
    <ul className="divide-y divide-border">{items.map((item) => <li key={item.id}><button onClick={() => onOpen(item.id, item.href)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-subtle">
      <span className="mt-1.5 w-2 shrink-0">{!item.read && <span className="block h-2 w-2 rounded-full bg-primary" />}</span><span className="min-w-0 flex-1"><span className={`block text-[13px] text-ink ${item.read ? "font-normal" : "font-semibold"}`}>{item.title}</span><span className="mt-0.5 block text-[13px] text-ink-2">{item.body}</span></span><span className="shrink-0 text-xs text-ink-3">{relTime(item.at)}</span>
    </button></li>)}</ul>
  </section>;
}
