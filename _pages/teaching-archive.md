---
layout: archive
title: "Archived courses"
hide_title: true
permalink: /teaching-archive/
author_profile: true
---

{% include base_path %}

{% assign archived_courses = site.teaching | where_exp: "post", "post.archived == true" | reverse %}
{% for post in archived_courses %}
  {% include archive-single.html %}
{% endfor %}

<p style="margin-top: 2em"><a href="{{ base_path }}/teaching/">← 返回当前课程</a></p>
