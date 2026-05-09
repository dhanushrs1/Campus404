import { APP_ROUTES } from "../routes/paths.js";
import { CheckCircle, Activity, Award } from "lucide-react";
import "./FrontendDashboardPage.css";

const FRONTEND_AREAS = [
  {
    title: "Learning Queue",
    description: "Continue pending tasks and watch submission status by challenge.",
    icon: <CheckCircle className="frontendDashboardPage__cardIcon" size={24} />,
  },
  {
    title: "Progress Sync",
    description: "Track current level, completed streak, and skill growth markers.",
    icon: <Activity className="frontendDashboardPage__cardIcon" size={24} />,
  },
  {
    title: "Practice Arena",
    description: "Start coding sessions and push fast submissions directly.",
    icon: <Award className="frontendDashboardPage__cardIcon" size={24} />,
  },
];

export default function FrontendDashboardPage() {
  return (
    <div className="frontendDashboardPage">
      <header className="frontendDashboardPage__header">
        <p className="frontendDashboardPage__eyebrow">Interactive Environment</p>
        <h1>Your Dashboard</h1>
        <p>Advanced metrics and execution gateways are securely routed through `{APP_ROUTES.frontendDashboard}`.</p>
      </header>

      <section className="frontendDashboardPage__grid">
        {FRONTEND_AREAS.map((item) => (
          <article className="frontendDashboardPage__card card" key={item.title}>
            <div className="frontendDashboardPage__cardHeader">
              {item.icon}
              <h2>{item.title}</h2>
            </div>
            <p>{item.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}