import { TableSkeleton } from './skeletons'

/**
 * Shown only for the few hundred ms a lazily-loaded route chunk takes to
 * arrive. Renders inside the already-painted shell, so the sidebar and header
 * stay put — the page never blanks.
 */
export default function RouteFallback() {
  return (
    <div className="mf-page" aria-busy="true">
      <div className="mf-page-header">
        <div className="mf-page-header__text">
          <span className="mf-skel mf-skel--title" />
          <span className="mf-skel mf-skel--subtitle" />
        </div>
      </div>
      <section className="mf-card">
        <div className="mf-card__body">
          <TableSkeleton rows={6} cols={5} />
        </div>
      </section>
    </div>
  )
}
