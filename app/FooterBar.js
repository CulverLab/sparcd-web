
/** @module components/FooterBar */

import { useTheme } from '@mui/material/styles';

import styles from './components/components.module.css';

const COPYRIGHT_START_YEAR = 2023;

/**
 * Renders the footer bar
 * @function
 * @returns {object} The rendered footer
 */
export default function FooterBar() {
  const theme = useTheme();
  const curYear = new Date().getFullYear();
  const prevYear = curYear <= COPYRIGHT_START_YEAR ? "" : `${COPYRIGHT_START_YEAR}-`;

  return (
    <footer id='sparcd-footer' style={{...theme.palette.footer_bar}}>
      <div id="footer_details_wrapper" style={{...theme.palette.footer_wrapper}} >
        <div className={styles.footer_sub_title} aria-describedby="footer-contibutors-title">Contributors&nbsp;
          <span className={styles.footer_more_info}>&#x00BB;</span>
        </div>
        <div className={`${styles.footer_details_wrapper} ${styles.footer_details_left}`} role="region" id="footer-contibutors">
          <div style={{...theme.palette.footer_sub_item}}>UA Computer Science <span style={{...theme.palette.footer_outside_link}}>&#x2197;</span></div>
          <div style={{...theme.palette.footer_sub_item}}>UA Communications & Cyber Technologies Data Science <span style={{...theme.palette.footer_outside_link}}>&#x2197;</span></div>
          <div style={{...theme.palette.footer_sub_item}}>UA Wildcat Research and Conservation Center <span style={{...theme.palette.footer_outside_link}}>&#x2197;</span></div>
          <div style={{...theme.palette.footer_sub_item}}>School of Natural Resources and the Environment <span style={{...theme.palette.footer_outside_link}}>&#x2197;</span></div>
        </div>
      </div>
      <div style={{...theme.palette.footer_copyright}}>Copyright &copy; {prevYear}{curYear}</div>
      <div style={{...theme.palette.footer_wrapper, justifyContent: 'center'}}>
        <div className={styles.footer_sub_title} aria-describedby="footer_credits">Credits&nbsp;
          <span className={styles.footer_more_info}>&#x00BB;</span>
        </div>
        <div className={`${styles.footer_details_wrapper} ${styles.footer_details_right}`} role="tooltip" id="footer_credits">
          <div style={{...theme.palette.footer_sub_item}}>Dr. Melanie Culver <span style={{...theme.palette.footer_outside_link}}>&#x2197;</span></div>
          <div style={{...theme.palette.footer_sub_item}}>Susan Malusa <span style={{...theme.palette.footer_outside_link}}>&#x2197;</span></div>
          <div style={{...theme.palette.footer_sub_item}}>David Slovilosky <span style={{...theme.palette.footer_outside_link}}>&#x2197;</span></div>
          <div style={{...theme.palette.footer_sub_item}}>Julian Pistorus <span style={{...theme.palette.footer_outside_link}}>&#x2197;</span></div>
          <div style={{...theme.palette.footer_sub_item}}>Chris Schnaufer <span style={{...theme.palette.footer_outside_link}}>&#x2197;</span></div>
        </div>
      </div>
    </footer>
  );
}