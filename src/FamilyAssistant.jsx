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
  const itemCount = Number(shoppingListCount || 0) + Number(customItemCount || 0);

  let assistantMessage = "পরিবারের বাজারের তালিকা তৈরি করুন। আপনার পছন্দের পণ্য যোগ করলে বাজেটের হিসাবও একসঙ্গে দেখতে পারবেন।";
  if (remaining < 0) {
    assistantMessage = "আপনার খরচ ও পরিকল্পিত বাজার নির্ধারিত বাজেট ছাড়িয়েছে। তালিকাটি একটু সমন্বয় করে নিন।";
  } else if (progress >= 80) {
    assistantMessage = "আপনার বাজেটের বড় অংশ ব্যবহার হয়েছে। নতুন পণ্য যোগ করার আগে অবশিষ্ট টাকা দেখে নিন।";
  } else if (itemCount > 0) {
    assistantMessage = `আপনার তালিকায় ${itemCount.toLocaleString("bn-BD")}টি পণ্য আছে। পরিকল্পিত বাজারসহ ৳${formatMoney(remaining)} অবশিষ্ট।`;
  }

  return (
    <section className="bb-fa-dashboard" aria-labelledby="bb-fa-title">
      <header className="bb-fa-heading">
        <div>
          <span className="bb-fa-kicker">BAZARBONDHU · SMART FAMILY</span>
          <h1 id="bb-fa-title">Family Assistant</h1>
          <p>পরিবারের বাজার, বাজেট ও পছন্দের পণ্য—সবকিছু গুছিয়ে রাখুন এক জায়গায়।</p>
        </div>
        <span className="bb-fa-status"><i /> আপনার পরিবারের জন্য</span>
      </header>

      <div className="bb-fa-hero">
        <div className="bb-fa-hero-copy">
          <span className="bb-fa-hero-label">আপনার পরিবারের স্মার্ট বাজার সহকারী</span>
          <h2>পরিকল্পিত বাজারে<br /><em>সাশ্রয়ী ও নিশ্চিন্ত পরিবার</em></h2>
          <p>প্রয়োজন বুঝে বাজার সাজান, খরচের হিসাব রাখুন এবং আগের বাজার সহজেই আবার ব্যবহার করুন।</p>
          <div className="bb-fa-hero-actions">
            <button type="button" className="bb-fa-primary" onClick={onOpenPlanner}>🧺 বাজারের তালিকা সাজান</button>
            <button type="button" className="bb-fa-ghost" onClick={onLoadPrevious} disabled={loadingPrevious}>
              {loadingPrevious ? "তালিকা আনা হচ্ছে…" : "↻ আগের বাজার আনুন"}
            </button>
          </div>
        </div>
        <aside className="bb-fa-family-card" aria-label="পরিবারের প্রোফাইল">
          <div className="bb-fa-family-card-top">
            <span>FAMILY PROFILE</span>
            <span aria-hidden="true">✦</span>
          </div>
          <div className="bb-fa-avatars" aria-hidden="true">
            <span>👨</span><span>👩</span><span>🧒</span><span>＋</span>
          </div>
          <strong>{Number(familyMembers || 1).toLocaleString("bn-BD")} জন সদস্য</strong>
          <small>{packageLabel}</small>
          <button type="button" onClick={onEditSettings}>পরিবার ও বাজেট সেটিংস <span>→</span></button>
        </aside>
      </div>

      <div className="bb-fa-section-heading">
        <div><span>YOUR FAMILY OVERVIEW</span><h2>বাজারের সারসংক্ষেপ</h2></div>
        <button type="button" onClick={onEditSettings}>⚙ সেটিংস</button>
      </div>

      <div className="bb-fa-overview">
        <article className="bb-fa-budget-card">
          <div className="bb-fa-budget-heading">
            <div><span>MONTHLY BUDGET</span><h3>পরিবারের বাজেট</h3></div>
            <span className="bb-fa-budget-icon">৳</span>
          </div>
          <strong className="bb-fa-budget-amount">৳{formatMoney(budgetLimit)}</strong>
          <div className="bb-fa-budget-track" role="progressbar" aria-label="বাজেট ব্যবহারের অগ্রগতি" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
            <span className={remaining < 0 ? "is-over" : ""} style={{ width: `${progress}%` }} />
          </div>
          <div className="bb-fa-budget-foot">
            <span>ব্যবহৃত <b>৳{formatMoney(committedTotal)}</b></span>
            <span className={remaining < 0 ? "is-over" : ""}>অবশিষ্ট <b>৳{formatMoney(remaining)}</b></span>
          </div>
        </article>
        <article className="bb-fa-metric-card">
          <span className="bb-fa-metric-icon">🛍️</span>
          <small>সম্পন্ন বাজার</small>
          <strong>৳{formatMoney(monthlySpend)}</strong>
          <span>এ পর্যন্ত খরচ</span>
        </article>
        <article className="bb-fa-metric-card">
          <span className="bb-fa-metric-icon">📋</span>
          <small>পরিকল্পিত বাজার</small>
          <strong>৳{formatMoney(plannedTotal)}</strong>
          <span>{itemCount.toLocaleString("bn-BD")}টি পণ্য তালিকায়</span>
        </article>
      </div>

      <div className="bb-fa-insight">
        <span className="bb-fa-insight-icon">✦</span>
        <div><small>SMART FAMILY INSIGHT</small><h3>আপনার বাজার সহকারীর পরামর্শ</h3><p>{assistantMessage}</p></div>
      </div>

      <div className="bb-fa-tools">
        <div className="bb-fa-section-heading">
          <div><span>FAMILY TOOLS</span><h2>আপনার পরিবারের প্রয়োজনীয় সুবিধা</h2></div>
        </div>
        <div className="bb-fa-tool-grid">
          <button type="button" className="bb-fa-tool" onClick={onOpenPlanner}>
            <span className="bb-fa-tool-icon is-green">🧺</span><span><b>পরিবারের বাজারের তালিকা</b><small>পণ্য যোগ করুন ও পরিমাণ ঠিক করুন</small></span><i>→</i>
          </button>
          <button type="button" className="bb-fa-tool" onClick={onLoadPrevious} disabled={loadingPrevious}>
            <span className="bb-fa-tool-icon is-gold">↻</span><span><b>আগের বাজার আবার আনুন</b><small>{loadingPrevious ? "আগের তালিকা আনা হচ্ছে…" : "আগের অর্ডারের তালিকা ব্যবহার করুন"}</small></span><i>→</i>
          </button>
          <button type="button" className="bb-fa-tool" onClick={onEditSettings}>
            <span className="bb-fa-tool-icon is-blue">👨‍👩‍👧</span><span><b>পরিবার ও বাজেট</b><small>সদস্য সংখ্যা ও প্যাকেজ পরিবর্তন করুন</small></span><i>→</i>
          </button>
        </div>
      </div>

      <div className="bb-fa-suggestions">
        <div className="bb-fa-section-heading">
          <div><span>SMART PRODUCT PICKS</span><h2>আপনার পরিবারের জন্য পণ্যের পরামর্শ</h2></div>
          <span className="bb-fa-suggestion-count">{suggestions.length}টি পণ্য</span>
        </div>
        {suggestions.length ? (
          <div className="bb-fa-suggestion-grid">
            {suggestions.map((product) => (
              <article className="bb-fa-suggestion" key={product.id}>
                {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <span className="bb-fa-product-placeholder">🛒</span>}
                <div className="bb-fa-product-info">
                  <strong>{product.name}</strong>
                  <small>{[product.brand, product.variant].filter(Boolean).join(" · ") || "নিত্যপ্রয়োজনীয় পণ্য"}</small>
                  <b>৳{formatMoney(product.price)} / {product.unit || "টি"}</b>
                </div>
                <button type="button" onClick={() => onAddSuggestion(product)}>+ তালিকায় যোগ</button>
              </article>
            ))}
          </div>
        ) : <p className="bb-fa-empty">এই মুহূর্তে নতুন পণ্যের সাজেশন নেই। আপনার বাজারের তালিকা থেকে প্রয়োজনীয় পণ্য যোগ করতে পারেন।</p>}
        <p className="bb-fa-note">পণ্যের সাজেশন স্টক ও আপনার বর্তমান তালিকার ভিত্তিতে দেখানো হয়। অর্ডার করার আগে পণ্য ও পরিমাণ যাচাই করুন।</p>
      </div>
    </section>
  );
}
