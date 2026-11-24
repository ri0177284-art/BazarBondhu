import "./FamilyAssistant.css";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("bn-BD", { maximumFractionDigits: 0 });
}

export default function FamilyAssistantDashboard({
  familyMembers,
  packageLabel,
  budgetLimit,
  monthlySpend,
  plannedTotal,
  shoppingListCount,
  customItemCount,
  suggestions = [],
  loadingPrevious,
  onOpenPlanner,
  onLoadPrevious,
  onEditSettings,
  onAddSuggestion,
}) {
  const committedTotal = Number(monthlySpend || 0) + Number(plannedTotal || 0);
  const remaining = Number(budgetLimit || 0) - committedTotal;
  const progress = Number(budgetLimit) > 0
    ? Math.min(100, Math.round((committedTotal / Number(budgetLimit)) * 100))
    : 0;

  let assistantMessage = "আপনার পরিবারের বাজারের তালিকা তৈরি করুন। পছন্দের পণ্য যোগ করলে বাজেট ও বাজারের হিসাব একসাথে দেখতে পারবেন।";
  if (remaining < 0) {
    assistantMessage = "আপনার বর্তমান খরচ ও পরিকল্পিত বাজার বাজেট ছাড়িয়ে যাচ্ছে। তালিকার পরিমাণ বা পণ্য পরিবর্তন করে বাজেটের মধ্যে নিয়ে আসুন।";
  } else if (progress >= 80) {
    assistantMessage = "আপনার বাজেটের বড় অংশ ব্যবহার হয়ে গেছে। নতুন পণ্য যোগ করার আগে অবশিষ্ট বাজেট দেখে নিন।";
  } else if (shoppingListCount + customItemCount > 0) {
    assistantMessage = `আপনার তালিকায় ${(shoppingListCount + customItemCount).toLocaleString("bn-BD")}টি পণ্য আছে। পরিকল্পিত বাজারসহ এখনো ৳${formatMoney(remaining)} বাজেট অবশিষ্ট।`;
  }

  return (
    <section className="bb-fa-dashboard" aria-labelledby="bb-fa-title">
      <div className="bb-fa-hero">
        <div className="bb-fa-hero-copy">
          <span className="bb-fa-eyebrow">✦ BAZARBONDHU SMART FAMILY</span>
          <h1 id="bb-fa-title">আপনার পরিবারের বাজার সহকারী</h1>
          <p>পরিবারের বাজার, বাজেট ও পছন্দের পণ্য—সবকিছু এক জায়গায় গুছিয়ে রাখুন।</p>
          <div className="bb-fa-hero-actions">
            <button type="button" className="bb-fa-primary" onClick={onOpenPlanner}>🧺 বাজারের তালিকা সাজান</button>
            <button type="button" className="bb-fa-secondary" onClick={onLoadPrevious} disabled={loadingPrevious}>
              {loadingPrevious ? "লোড হচ্ছে…" : "↻ আগের বাজার আনুন"}
            </button>
          </div>
        </div>
        <div className="bb-fa-hero-art" aria-hidden="true">
          <span className="bb-fa-art-orbit" />
          <span className="bb-fa-art-basket">🧺</span>
          <span className="bb-fa-art-float bb-fa-art-one">🥬</span>
          <span className="bb-fa-art-float bb-fa-art-two">🥚</span>
          <span className="bb-fa-art-float bb-fa-art-three">🫒</span>
          <span className="bb-fa-art-caption">পরিকল্পিত বাজার, নিশ্চিন্ত পরিবার</span>
        </div>
      </div>

      <div className="bb-fa-summary-heading">
        <div>
          <span className="bb-fa-section-kicker">FAMILY OVERVIEW</span>
          <h2>এই সময়ের বাজারের হিসাব</h2>
        </div>
        <button type="button" onClick={onEditSettings}>⚙ বাজেট পরিবর্তন</button>
      </div>

      <div className="bb-fa-stats">
        <article className="bb-fa-stat">
          <span className="bb-fa-stat-icon">👨‍👩‍👧‍👦</span>
          <span className="bb-fa-stat-label">পরিবারের সদস্য</span>
          <strong>{Number(familyMembers || 1).toLocaleString("bn-BD")} জন</strong>
          <small>{packageLabel}</small>
        </article>
        <article className="bb-fa-stat">
          <span className="bb-fa-stat-icon">🎯</span>
          <span className="bb-fa-stat-label">নির্ধারিত বাজেট</span>
          <strong>৳{formatMoney(budgetLimit)}</strong>
          <small>আপনার নির্ধারিত সীমা</small>
        </article>
        <article className="bb-fa-stat">
          <span className="bb-fa-stat-icon">🛍️</span>
          <span className="bb-fa-stat-label">ইতিমধ্যে খরচ</span>
          <strong>৳{formatMoney(monthlySpend)}</strong>
          <small>সম্পন্ন বাজার</small>
        </article>
        <article className="bb-fa-stat">
          <span className="bb-fa-stat-icon">📋</span>
          <span className="bb-fa-stat-label">পরিকল্পিত বাজার</span>
          <strong>৳{formatMoney(plannedTotal)}</strong>
          <small>{(shoppingListCount + customItemCount).toLocaleString("bn-BD")}টি তালিকাভুক্ত পণ্য</small>
        </article>
      </div>

      <div className="bb-fa-budget-card">
        <div className="bb-fa-budget-top">
          <div>
            <span className="bb-fa-section-kicker">SMART BUDGET TRACKER</span>
            <h2>বাজেটের অগ্রগতি</h2>
          </div>
          <strong className={remaining < 0 ? "is-over" : ""}>{progress.toLocaleString("bn-BD")}%</strong>
        </div>
        <div className="bb-fa-progress" role="progressbar" aria-label="বাজেট ব্যবহারের অগ্রগতি" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
          <span className={remaining < 0 ? "is-over" : ""} style={{ width: `${progress}%` }} />
        </div>
        <div className="bb-fa-budget-breakdown">
          <span>খরচ + পরিকল্পনা <strong>৳{formatMoney(committedTotal)}</strong></span>
          <span className={remaining < 0 ? "is-over" : ""}>অবশিষ্ট <strong>৳{formatMoney(remaining)}</strong></span>
        </div>
      </div>

      <div className="bb-fa-assistant-card">
        <div className="bb-fa-assistant-icon">✦</div>
        <div className="bb-fa-assistant-copy">
          <span>BAZARBONDHU SMART SUGGESTION</span>
          <h3>আপনার বাজার সহকারীর পরামর্শ</h3>
          <p>{assistantMessage}</p>
        </div>
      </div>

      <div className="bb-fa-suggestions">
        <div className="bb-fa-suggestions-heading">
          <div>
            <span className="bb-fa-section-kicker">SUGGESTED FOR YOUR FAMILY</span>
            <h2>আরও কিছু পণ্য দেখে নিতে পারেন</h2>
          </div>
          <span>✦ স্মার্ট সাজেশন</span>
        </div>
        {suggestions.length > 0 ? (
          <div className="bb-fa-suggestion-grid">
            {suggestions.map((product) => (
              <article className="bb-fa-suggestion" key={product.id}>
                {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <span className="bb-fa-suggestion-placeholder">🛒</span>}
                <div className="bb-fa-suggestion-info">
                  <strong>{product.name}</strong>
                  <small>{[product.brand, product.variant].filter(Boolean).join(" · ") || "নিত্যপ্রয়োজনীয় পণ্য"}</small>
                  <b>৳{formatMoney(product.price)} / {product.unit || "টি"}</b>
                </div>
                <button type="button" onClick={() => onAddSuggestion(product)}>+ তালিকায় যোগ</button>
              </article>
            ))}
          </div>
        ) : (
          <p className="bb-fa-no-suggestions">এই মুহূর্তে নতুন সাজেস্ট করার মতো অতিরিক্ত পণ্য পাওয়া যাচ্ছে না। পণ্যের তালিকা থেকে আপনার প্রয়োজনীয় পণ্য যোগ করতে পারেন।</p>
        )}
        <p className="bb-fa-note">সাজেশনগুলো আপনার বর্তমান তালিকা, পণ্যের ক্যাটাগরি ও স্টকের ভিত্তিতে তৈরি। অর্ডার করার আগে পণ্য ও পরিমাণ নিজে যাচাই করুন।</p>
      </div>
    </section>
  );
}
