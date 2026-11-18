"use client";
export default function RetryButton() {
  return <button className="btn-primary mt-6" onClick={() => location.reload()}>Try again</button>;
}
