FROM ubuntu:14.04
MAINTAINER @3846masa

ENV LANG C.UTF-8
RUN apt update && \
    apt install -y curl git build-essential software-properties-common time

# nodejs
RUN curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash - && \
    apt install -y --force-yes nodejs

# Swift
# MIT Copyright (C) 2015 by Haris Amin
# https://github.com/swiftdocker/docker-swift
RUN SWIFT_VERSION='2.2-SNAPSHOT-2015-12-01-b' && \
   SWIFT_PLATFORM='ubuntu14.04' && \
   apt install -y --force-yes clang python2.7-dev libicu52 libicu-dev && \
   SWIFT_ARCHIVE_NAME=swift-$SWIFT_VERSION-$SWIFT_PLATFORM && \
   SWIFT_URL=https://swift.org/builds/$(echo "$SWIFT_PLATFORM" | tr -d .)/swift-$SWIFT_VERSION/$SWIFT_ARCHIVE_NAME.tar.gz && \
   curl -LO $SWIFT_URL && \
   tar -xvzf $SWIFT_ARCHIVE_NAME.tar.gz --directory / --strip-components=1 && \
   rm -rf $SWIFT_ARCHIVE_NAME* /tmp/* /var/tmp/*

# C#
RUN apt install -y --force-yes mono-complete

# Ruby
RUN apt-add-repository -y ppa:brightbox/ruby-ng && \
    apt update && apt install -y --force-yes ruby2.2

# PHP7.0
RUN apt-add-repository -y ppa:ondrej/php-7.0 && \
    apt update && apt install -y --force-yes php7.0

# Python
RUN apt install -y --force-yes python python3

# Perl6
# The Artistic License 2.0 Copyright (c) 2000-2006, The Perl Foundation.
# https://github.com/perl6/docker
RUN rakudo_version=2015.11 && \
    mkdir /root/rakudo && \
    curl -fsSL -o rakudo.tar.gz \
      http://rakudo.org/downloads/star/rakudo-star-${rakudo_version}.tar.gz && \
    tar xzf rakudo.tar.gz --strip-components=1 -C /root/rakudo && \
    ( \
      cd /root/rakudo && \
      perl Configure.pl --prefix=/usr --gen-moar && \
      make -j"$(nproc)" install \
    ) && \
    rm -rf /rakudo.tar.gz /root/rakudo

# Java8
RUN echo oracle-java8-installer \
      shared/accepted-oracle-license-v1-1 select true | \
    debconf-set-selections && \
    add-apt-repository -y ppa:webupd8team/java && \
    apt update && \
    apt install -y --force-yes oracle-java8-installer

# Haskell
RUN apt install -y --force-yes haskell-platform

# Processing
RUN apt install -y --force-yes  xvfb libxrender1 libxtst6 libxi6 && \
    curl -LO http://download.processing.org/processing-3.0-linux64.tgz && \
    mkdir -p /root/processing && \
    tar zxvf processing-3.0-linux64.tgz \
      --directory /root/processing --strip-components=1 && \
    rm -rf processing-3.0-linux64.tgz

# # C C++
# RUN add-apt-repository -y ppa:ubuntu-toolchain-r/test && \
#     apt update && \
#     apt install -y --force-yes gcc-4.9 g++-4.9 && \
#     update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-4.9 60 \
#     --slave /usr/bin/g++ g++ /usr/bin/g++-4.9

# main script
ADD ./index.js /root/index.js
ADD ./package.json /root/package.json

# npm install
RUN cd /root && npm install

VOLUME ["/data/script", "/data/question"]
WORKDIR /root
ENTRYPOINT ["node", "index.js"]
CMD [""]
